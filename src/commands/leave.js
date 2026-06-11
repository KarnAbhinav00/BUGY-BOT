const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { updateGuildSettings, getGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Manage leave messages.')
    .addSubcommand((subcommand) => subcommand
      .setName('set')
      .setDescription('Set the leave channel and message.')
      .addChannelOption((option) => option.setName('channel').setDescription('Leave channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
      .addStringOption((option) => option.setName('message').setDescription('Leave text. Use {user}, {username}, {server}.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('disable')
      .setDescription('Disable leave messages.')),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'disable') {
      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        leaveChannelId: ''
      }));

      await interaction.reply({ content: 'Leave messages disabled.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);

    updateGuildSettings(interaction.guild.id, (settings) => ({
      ...settings,
      leaveChannelId: channel.id,
      leaveMessage: message
    }));

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Leave messages configured')
      .setDescription(`Channel: ${channel}\nMessage: ${message}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const subcommand = message.content.trim().split(/\s+/)[1];

    if (subcommand === 'disable') {
      updateGuildSettings(message.guild.id, (settings) => ({
        ...settings,
        leaveChannelId: ''
      }));

      await message.reply({ content: 'Leave messages disabled.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const channel = message.mentions.channels.first();
    const leaveMessage = message.content.replace(/^\S+\s+\S+\s+<#\d+>\s*/i, '').trim();

    if (!channel || !leaveMessage) {
      await message.reply({ content: 'Usage: !leave set #channel message', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    updateGuildSettings(message.guild.id, (settings) => ({
      ...settings,
      leaveChannelId: channel.id,
      leaveMessage: leaveMessage
    }));

    await message.reply({ content: `Leave messages configured for ${channel}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};