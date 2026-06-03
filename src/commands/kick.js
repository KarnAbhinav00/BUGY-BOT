const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { kickMember } = require('../utils/mod-actions');
const { getGuildSettings } = require('../storage/guild-settings');
const { logModerationAction } = require('../utils/mod-log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member.')
    .addUserOption((option) => option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)) {
      await interaction.reply({ content: 'You need Kick Members to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
      return;
    }

    await kickMember(member, reason);
    await logModerationAction(interaction.guild, getGuildSettings(interaction.guild.id), {
      action: 'Kick',
      target: `${user.tag} (${user.id})`,
      moderator: interaction.user.tag,
      reason,
      channel: `${interaction.channel.name || interaction.channel.id}`
    });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('Member kicked').setDescription(`User: ${user.tag}\nReason: ${reason}`)], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      await message.reply({ content: 'You need Kick Members to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const user = message.mentions.users.first();
    if (!user) {
      await message.reply({ content: 'Usage: !kick @user reason', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await message.reply({ content: 'That user is not in the server.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const reason = message.content.replace(/^\S+\s+<@!?\d+>\s*/i, '').trim() || 'No reason provided';
    await kickMember(member, reason);
    await logModerationAction(message.guild, getGuildSettings(message.guild.id), {
      action: 'Kick',
      target: `${user.tag} (${user.id})`,
      moderator: message.author.tag,
      reason,
      channel: `${message.channel.name || message.channel.id}`
    });
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('Member kicked').setDescription(`User: ${user.tag}\nReason: ${reason}`)], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};