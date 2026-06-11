const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

function describeRole(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return `<@&${roleId}> (missing)`;
  }

  return `${role} | position ${role.position}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hierarchy')
    .setDescription('Show the configured bot command hierarchy.'),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Bot Command Hierarchy')
      .setDescription([
        `Owners: ${(settings.whitelist.ownerIds || []).map((id) => `<@${id}>`).join(', ') || 'None'}`,
        `Admins: ${(settings.whitelist.adminRoleIds || []).map((id) => describeRole(interaction.guild, id)).join('\n') || 'None'}`,
        `Staff: ${(settings.whitelist.staffRoleIds || []).map((id) => describeRole(interaction.guild, id)).join('\n') || 'None'}`
      ].join('\n\n'))
      .setFooter({ text: `Fetched from server roles in ${interaction.guild.name}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Bot Command Hierarchy')
      .setDescription([
        `Owners: ${(settings.whitelist.ownerIds || []).map((id) => `<@${id}>`).join(', ') || 'None'}`,
        `Admins: ${(settings.whitelist.adminRoleIds || []).map((id) => describeRole(message.guild, id)).join('\n') || 'None'}`,
        `Staff: ${(settings.whitelist.staffRoleIds || []).map((id) => describeRole(message.guild, id)).join('\n') || 'None'}`
      ].join('\n\n'))
      .setFooter({ text: `Fetched from server roles in ${message.guild.name}` });

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};