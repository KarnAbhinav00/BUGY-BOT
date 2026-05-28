const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');
const { getStaffStat } = require('../utils/staff-stats');
const { isWhitelistedMember } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show staff activity stats.')
    .addUserOption((option) => option.setName('user').setDescription('Staff member').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const settings = getGuildSettings(interaction.guild.id);

    if (member && !isWhitelistedMember(member, settings) && !interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({ content: 'That profile is only visible for staff members.', ephemeral: true });
      return;
    }

    const stats = getStaffStat(settings, user.id);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Staff Profile: ${user.tag}`)
      .setDescription([
        `Messages handled: ${stats.messages || 0}`,
        `Voice time: ${stats.voiceMinutes || 0} minutes`,
        `Tickets handled: ${stats.ticketsHandled || 0}`,
        `Claims: ${stats.claims || 0}`,
        `Escalations: ${stats.escalations || 0}`
      ].join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    const user = message.mentions.users.first() || message.author;
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    const settings = getGuildSettings(message.guild.id);

    if (member && !isWhitelistedMember(member, settings) && !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ content: 'That profile is only visible for staff members.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const stats = getStaffStat(settings, user.id);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Staff Profile: ${user.tag}`)
      .setDescription([
        `Messages handled: ${stats.messages || 0}`,
        `Voice time: ${stats.voiceMinutes || 0} minutes`,
        `Tickets handled: ${stats.ticketsHandled || 0}`,
        `Claims: ${stats.claims || 0}`,
        `Escalations: ${stats.escalations || 0}`
      ].join('\n'));

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};