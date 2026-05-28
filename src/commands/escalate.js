const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isTicketChannel } = require('../utils/ticket-history');
const { updateStaffStat } = require('../utils/staff-stats');

const ESCALATION_TICKET_ACCESS_ROLE_ID = '1500377466298962121';

function getManagedStaffRoleIds(settings, extraRoleIds = []) {
  return [...new Set([...(settings.whitelist?.staffRoleIds || []), '1490684254169075913', ...extraRoleIds])];
}

async function ensurePermanentTicketAccess(guild, settings, extraRoleIds = []) {
  const roleIds = getManagedStaffRoleIds(settings, extraRoleIds);
  const ticketChannels = guild.channels.cache.filter((channel) => isTicketChannel(channel) && channel.topic?.startsWith('ticket-owner:'));

  for (const channel of ticketChannels.values()) {
    for (const roleId of roleIds) {
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: true,
        AttachFiles: true
      }, { reason: 'Permanent escalation ticket access' }).catch(() => null);
    }
  }
}

async function applyEscalation(guild, executor, targetRole, reason) {
  const settings = getGuildSettings(guild.id);
  if (targetRole.managed) {
    return { ok: false, message: 'That role is managed by an integration and cannot be escalated.' };
  }

  if (targetRole.position >= guild.members.me.roles.highest.position) {
    return { ok: false, message: 'I cannot assign that role because it is above my highest role.' };
  }

  updateGuildSettings(guild.id, (current) => {
    const staffRoleIds = new Set([...(current.whitelist?.staffRoleIds || []), targetRole.id]);

    return {
      ...current,
      whitelist: {
        ...(current.whitelist || { ownerIds: [], adminRoleIds: [], staffRoleIds: [] }),
        staffRoleIds: [...staffRoleIds]
      }
    };
  });

  await ensurePermanentTicketAccess(guild, settings, [targetRole.id]);

  updateStaffStat(guild.id, executor.id, (current) => ({
    ...current,
    escalations: (current.escalations || 0) + 1
  }));

  const logChannel = settings.moderationLogChannelId ? guild.channels.cache.get(settings.moderationLogChannelId) : null;
  if (logChannel?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Role escalated')
      .setDescription([
        `Role: ${targetRole}`,
        `Executor: ${executor.tag}`,
        `Reason: ${reason}`
      ].join('\n'))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  }

  return { ok: true, role: targetRole };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('escalate')
    .setDescription('Grant a staff role ticket access.')
    .addRoleOption((option) => option.setName('role').setDescription('Role to escalate').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the escalation').setRequired(false)),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const allowed = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);

    if (!allowed) {
      await interaction.reply({ content: 'You need Manage Server to use this command.', ephemeral: true });
      return;
    }

    const targetRole = interaction.options.getRole('role', true);

    const reason = interaction.options.getString('reason') || `Escalated by ${interaction.user.tag}`;
    await ensurePermanentTicketAccess(interaction.guild, settings, [targetRole.id]);

    const result = await applyEscalation(interaction.guild, interaction.user, targetRole, reason);

    if (!result.ok) {
      await interaction.reply({ content: result.message, ephemeral: true });
      return;
    }

    await interaction.reply({ content: `⚡ Escalated ${result.role}.`, ephemeral: true });
  },
  async handleMessage(message, args = []) {
    const settings = getGuildSettings(message.guild.id);
    const allowed = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (!allowed) {
      await message.reply({ content: 'You need Manage Server to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const targetRole = message.mentions.roles.first() || await message.guild.roles.fetch(args[1]).catch(() => null);

    if (!targetRole) {
      await message.reply({ content: 'Usage: !escalate @role [reason]', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const reason = message.content.replace(/^\S+\s+<@&?\d+>\s*/i, '').trim() || `Escalated by ${message.author.tag}`;
    await ensurePermanentTicketAccess(message.guild, settings, [targetRole.id]);

    const result = await applyEscalation(message.guild, message.author, targetRole, reason);

    if (!result.ok) {
      await message.reply({ content: result.message, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    await message.reply({ content: `⚡ Escalated ${result.role}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
