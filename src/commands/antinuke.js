const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure anti-nuke protection.')
    .addSubcommand((subcommand) => subcommand
      .setName('enable')
      .setDescription('Enable anti-nuke protection.')
      .addIntegerOption((option) => option.setName('threshold').setDescription('Actions before punishment').setMinValue(2).setRequired(false))
      .addStringOption((option) => option.setName('punishment').setDescription('timeout or ban').addChoices({ name: 'timeout', value: 'timeout' }, { name: 'ban', value: 'ban' }).setRequired(false))
      .addIntegerOption((option) => option.setName('timeout_minutes').setDescription('Timeout length when punishment is timeout').setMinValue(1).setRequired(false))
      .addChannelOption((option) => option.setName('log_channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('disable')
      .setDescription('Disable anti-nuke protection.'))
    .addSubcommand((subcommand) => subcommand
      .setName('status')
      .setDescription('Show anti-nuke settings.')),
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
        antiNuke: {
          ...settings.antiNuke,
          enabled: false
        }
      }));

      await interaction.reply({ content: 'Anti-nuke protection disabled.', ephemeral: true });
      return;
    }

    if (subcommand === 'status') {
      const settings = getGuildSettings(interaction.guild.id);
      const antiNuke = settings.antiNuke;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Anti-nuke status')
        .setDescription([
          `Enabled: ${antiNuke.enabled ? 'Yes' : 'No'}`,
          `Threshold: ${antiNuke.threshold}`,
          `Punishment: ${antiNuke.punishment}`,
          `Timeout minutes: ${antiNuke.timeoutMinutes}`,
          `Log channel: ${antiNuke.logChannelId ? `<#${antiNuke.logChannelId}>` : 'Not set'}`
        ].join('\n'));

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const threshold = interaction.options.getInteger('threshold') ?? undefined;
    const punishment = interaction.options.getString('punishment') ?? undefined;
    const timeoutMinutes = interaction.options.getInteger('timeout_minutes') ?? undefined;
    const logChannel = interaction.options.getChannel('log_channel');

    updateGuildSettings(interaction.guild.id, (settings) => ({
      ...settings,
      antiNuke: {
        ...settings.antiNuke,
        enabled: true,
        threshold: threshold ?? settings.antiNuke.threshold,
        punishment: punishment ?? settings.antiNuke.punishment,
        timeoutMinutes: timeoutMinutes ?? settings.antiNuke.timeoutMinutes,
        logChannelId: logChannel?.id || settings.antiNuke.logChannelId
      }
    }));

    await interaction.reply({ content: 'Anti-nuke protection enabled and updated.', ephemeral: true });
  },
  async handleMessage(message, args = []) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const [subcommand] = args.slice(1);

    if (subcommand === 'disable') {
      updateGuildSettings(message.guild.id, (settings) => ({
        ...settings,
        antiNuke: {
          ...settings.antiNuke,
          enabled: false
        }
      }));

      await message.reply({ content: 'Anti-nuke protection disabled.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'status') {
      const settings = getGuildSettings(message.guild.id);
      const antiNuke = settings.antiNuke;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Anti-nuke status')
        .setDescription([
          `Enabled: ${antiNuke.enabled ? 'Yes' : 'No'}`,
          `Threshold: ${antiNuke.threshold}`,
          `Punishment: ${antiNuke.punishment}`,
          `Timeout minutes: ${antiNuke.timeoutMinutes}`,
          `Log channel: ${antiNuke.logChannelId ? `<#${antiNuke.logChannelId}>` : 'Not set'}`
        ].join('\n'));

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    await message.reply({ content: 'Usage: !antinuke enable | !antinuke disable | !antinuke status', allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};