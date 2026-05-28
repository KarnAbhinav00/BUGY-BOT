const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Manage welcome messages.')
    .addSubcommand((subcommand) => subcommand
      .setName('set')
      .setDescription('Set the welcome channel and message.')
      .addChannelOption((option) => option.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
      .addStringOption((option) => option.setName('message').setDescription('Welcome text. Use {user}, {username}, {server}, {membercount}.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('disable')
      .setDescription('Disable welcome messages.')),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'disable') {
      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        welcomeChannelId: ''
      }));

      await interaction.reply({ content: 'Welcome messages disabled.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);

    updateGuildSettings(interaction.guild.id, (settings) => ({
      ...settings,
      welcomeChannelId: channel.id,
      welcomeMessage: message
    }));

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Welcome messages configured')
      .setDescription(`Channel: ${channel}\nMessage: ${message}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ content: 'You need Manage Server to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const subcommand = message.content.trim().split(/\s+/)[1];

    if (subcommand === 'disable') {
      updateGuildSettings(message.guild.id, (settings) => ({
        ...settings,
        welcomeChannelId: ''
      }));

      await message.reply({ content: 'Welcome messages disabled.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const channel = message.mentions.channels.first();
    const welcomeMessage = message.content.replace(/^\S+\s+\S+\s+<#\d+>\s*/i, '').trim();

    if (!channel || !welcomeMessage) {
      await message.reply({ content: 'Usage: !welcome set #channel message', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    updateGuildSettings(message.guild.id, (settings) => ({
      ...settings,
      welcomeChannelId: channel.id,
      welcomeMessage: welcomeMessage
    }));

    await message.reply({ content: `Welcome messages configured for ${channel}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};