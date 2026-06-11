const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

function buildWelcomePanelEmbed(settings) {
  const greeting = settings.greeting || {};
  const currentChannelId = greeting.channelId || settings.welcomeChannelId;
  const currentChannel = currentChannelId ? `<#${currentChannelId}>` : 'Not configured';
  const messagePreview = greeting.message || settings.welcomeMessage || 'No welcome message configured.';
  const enabled = greeting.enabled !== false;

  return new EmbedBuilder()
    .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
    .setTitle('Welcome Setup Panel')
    .setDescription('Use this panel to manage the server welcome experience. Click buttons below to toggle or update settings.')
    .addFields(
      { name: 'Status', value: enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Channel', value: currentChannel, inline: true },
      { name: 'Message', value: messagePreview.length > 1024 ? `${messagePreview.slice(0, 1021)}...` : messagePreview, inline: false },
      { name: 'Template variables', value: '`{user}`, `{mention}`, `{username}`, `{usertag}`, `{userid}`, `{server}`, `{membercount}`', inline: false }
    );
}

function buildWelcomePanelButtons(settings) {
  const greeting = settings.greeting || {};
  const enabled = greeting.enabled !== false;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('welcome-toggle')
      .setLabel(enabled ? 'Disable Welcome' : 'Enable Welcome')
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('welcome-set-channel')
      .setLabel('Set Channel')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('welcome-set-message')
      .setLabel('Set Message')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function updateWelcomePanelMessage(guild, settings) {
  const panelChannelId = settings.greeting?.panelChannelId;
  const panelMessageId = settings.greeting?.panelMessageId;

  if (!panelChannelId || !panelMessageId) {
    return;
  }

  const channel = guild.channels.cache.get(panelChannelId);
  if (!channel?.isTextBased()) {
    return;
  }

  try {
    const panelMessage = await channel.messages.fetch(panelMessageId);
    await panelMessage.edit({ embeds: [buildWelcomePanelEmbed(settings)], components: [buildWelcomePanelButtons(settings)] });
  } catch {
    return;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Manage welcome messages.')
    .addSubcommand((subcommand) => subcommand
      .setName('set')
      .setDescription('Set the welcome channel and message.')
      .addChannelOption((option) => option.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
      .addStringOption((option) => option.setName('message').setDescription('Welcome text. Use {user}, {mention}, {username}, {server}, {membercount}.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('panel')
      .setDescription('Create or refresh the welcome setup panel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Panel channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('disable')
      .setDescription('Disable welcome messages.')),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);

    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need to be whitelisted to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'disable') {
      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        greeting: { ...(settings.greeting || {}), enabled: false }
      }));

      await interaction.reply({ content: 'Welcome messages disabled.', ephemeral: true });
      return;
    }

    if (subcommand === 'panel') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const settings = getGuildSettings(interaction.guild.id);
      const embed = buildWelcomePanelEmbed(settings);
      const components = [buildWelcomePanelButtons(settings)];

      const panelMessage = await channel.send({ embeds: [embed], components });
      updateGuildSettings(interaction.guild.id, (settingsData) => ({
        ...settingsData,
        greeting: {
          ...(settingsData.greeting || {}),
          panelChannelId: channel.id,
          panelMessageId: panelMessage.id
        }
      }));

      await interaction.reply({ content: `Welcome setup panel created in ${channel}.`, ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);

    updateGuildSettings(interaction.guild.id, (settings) => ({
      ...settings,
      welcomeChannelId: channel.id,
      welcomeMessage: message,
      greeting: {
        ...(settings.greeting || {}),
        enabled: true,
        channelId: channel.id,
        message
      }
    }));

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Welcome messages configured')
      .setDescription(`Channel: ${channel}\nMessage: ${message}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    const settings = getGuildSettings(message.guild.id);

    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need to be whitelisted to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const subcommand = message.content.trim().split(/\s+/)[1];

    if (subcommand === 'disable') {
      updateGuildSettings(message.guild.id, (settings) => ({
        ...settings,
        greeting: { ...(settings.greeting || {}), enabled: false }
      }));

      await message.reply({ content: 'Welcome messages disabled.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'panel') {
      const channel = message.mentions.channels.first() || message.channel;
      await this.handlePrefixPanel(message, channel);
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
      welcomeMessage: welcomeMessage,
      greeting: {
        ...(settings.greeting || {}),
        enabled: true,
        channelId: channel.id,
        message: welcomeMessage
      }
    }));

    await message.reply({ content: `Welcome messages configured for ${channel}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  },

  async handlePrefixPanel(message, channel) {
    const settings = getGuildSettings(message.guild.id);
    const embed = buildWelcomePanelEmbed(settings);
    const components = [buildWelcomePanelButtons(settings)];

    const panelMessage = await channel.send({ embeds: [embed], components });
    updateGuildSettings(message.guild.id, (settingsData) => ({
      ...settingsData,
      greeting: {
        ...(settingsData.greeting || {}),
        panelChannelId: channel.id,
        panelMessageId: panelMessage.id
      }
    }));

    await message.reply({ content: `Welcome setup panel created in ${channel}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  },

  async handleButton(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const currentGreeting = settings.greeting || {};

    if (interaction.customId === 'welcome-toggle') {
      const enabled = currentGreeting.enabled === false;
      const updatedSettings = updateGuildSettings(interaction.guild.id, (current) => ({
        ...current,
        greeting: {
          ...(current.greeting || {}),
          enabled,
          channelId: current.greeting?.channelId || current.welcomeChannelId,
          message: current.greeting?.message || current.welcomeMessage,
          panelChannelId: current.greeting?.panelChannelId,
          panelMessageId: current.greeting?.panelMessageId
        }
      }));

      await updateWelcomePanelMessage(interaction.guild, updatedSettings);
      await interaction.reply({ content: `Welcome messages are now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
      return;
    }

    if (interaction.customId === 'welcome-set-channel') {
      await interaction.reply({ content: 'To change the welcome channel, use `/welcome set #channel message` or `/config greeting set #channel message`.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'welcome-set-message') {
      await interaction.reply({ content: 'To change the welcome message, use `/welcome set #channel message` or `/config greeting set #channel message`.', ephemeral: true });
      return;
    }
  }
};