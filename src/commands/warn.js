const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');
const { logModerationAction } = require('../utils/mod-log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member.')
    .addUserOption((option) => option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: 'You need Moderate Members to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Warning issued').setDescription(`Member: ${user.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`);
    await logModerationAction(interaction.guild, getGuildSettings(interaction.guild.id), {
      action: 'Warn',
      target: `${user.tag} (${user.id})`,
      moderator: interaction.user.tag,
      reason,
      channel: `${interaction.channel.name || interaction.channel.id}`
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply({ content: 'You need Moderate Members to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const user = message.mentions.users.first();
    if (!user) {
      await message.reply({ content: 'Usage: !warn @user reason', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const reason = message.content.replace(/^\S+\s+<@!?\d+>\s*/i, '').trim() || 'No reason provided';
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Warning issued').setDescription(`Member: ${user.tag}\nModerator: ${message.author.tag}\nReason: ${reason}`);
    await logModerationAction(message.guild, getGuildSettings(message.guild.id), {
      action: 'Warn',
      target: `${user.tag} (${user.id})`,
      moderator: message.author.tag,
      reason,
      channel: `${message.channel.name || message.channel.id}`
    });
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};