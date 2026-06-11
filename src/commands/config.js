const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure protection, links, words, and greeting.')
    .addSubcommandGroup((group) => group
      .setName('words')
      .setDescription('Manage blocked words')
      .addSubcommand((subcommand) => subcommand
        .setName('add')
        .setDescription('Add blocked words')
        .addStringOption((option) => option.setName('words').setDescription('Comma-separated words').setRequired(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('remove')
        .setDescription('Remove blocked words')
        .addStringOption((option) => option.setName('words').setDescription('Comma-separated words').setRequired(true)))
      .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List blocked words')))
    .addSubcommandGroup((group) => group
      .setName('links')
      .setDescription('Manage blocked links')
      .addSubcommand((subcommand) => subcommand
        .setName('add')
        .setDescription('Add blocked links')
        .addStringOption((option) => option.setName('links').setDescription('Comma-separated links').setRequired(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('remove')
        .setDescription('Remove blocked links')
        .addStringOption((option) => option.setName('links').setDescription('Comma-separated links').setRequired(true)))
      .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List blocked links')))
    .addSubcommandGroup((group) => group
      .setName('greeting')
      .setDescription('Manage greeting messages')
      .addSubcommand((subcommand) => subcommand
        .setName('set')
        .setDescription('Set greeting channel and message')
        .addChannelOption((option) => option.setName('channel').setDescription('Greeting channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addStringOption((option) => option.setName('message').setDescription('Greeting message. Use {user}, {username}, {server}, {membercount}.').setRequired(true)))
      .addSubcommand((subcommand) => subcommand.setName('disable').setDescription('Disable greetings')))
    .addSubcommandGroup((group) => group
      .setName('protection')
      .setDescription('Manage punishments')
      .addSubcommand((subcommand) => subcommand
        .setName('set')
        .setDescription('Set protection toggles')
        .addBooleanOption((option) => option.setName('enabled').setDescription('Enable protection').setRequired(false))
        .addBooleanOption((option) => option.setName('delete_words').setDescription('Delete bad words').setRequired(false))
        .addBooleanOption((option) => option.setName('delete_links').setDescription('Delete links').setRequired(false))
        .addBooleanOption((option) => option.setName('timeout_words').setDescription('Timeout on bad words').setRequired(false))
        .addBooleanOption((option) => option.setName('timeout_links').setDescription('Timeout on links').setRequired(false))
        .addIntegerOption((option) => option.setName('timeout_minutes').setDescription('Timeout minutes').setRequired(false))
        .addIntegerOption((option) => option.setName('heat_threshold').setDescription('Raid heat threshold').setRequired(false))
        .addIntegerOption((option) => option.setName('lockdown_minutes').setDescription('Raid lockdown minutes').setRequired(false)))
      .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show protection status'))),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'words') {
      const settings = getGuildSettings(interaction.guild.id);
      const words = new Set(settings.blockedWords || []);

      if (subcommand === 'list') {
        await interaction.reply({ content: `Blocked words: ${[...words].slice(0, 50).join(', ')}${words.size > 50 ? ' ...' : ''}`, ephemeral: true });
        return;
      }

      const inputWords = interaction.options.getString('words', true).split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);

      for (const word of inputWords) {
        if (subcommand === 'add') {
          words.add(word);
        } else {
          words.delete(word);
        }
      }

      updateGuildSettings(interaction.guild.id, (current) => ({ ...current, blockedWords: [...words] }));
      await interaction.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} blocked words.`, ephemeral: true });
      return;
    }

    if (group === 'links') {
      const settings = getGuildSettings(interaction.guild.id);
      const links = new Set(settings.blockedLinks || []);

      if (subcommand === 'list') {
        await interaction.reply({ content: `Blocked links: ${[...links].join(', ') || 'None'}`, ephemeral: true });
        return;
      }

      const inputLinks = interaction.options.getString('links', true).split(',').map((link) => link.trim().toLowerCase()).filter(Boolean);

      for (const link of inputLinks) {
        if (subcommand === 'add') {
          links.add(link);
        } else {
          links.delete(link);
        }
      }

      updateGuildSettings(interaction.guild.id, (current) => ({ ...current, blockedLinks: [...links] }));
      await interaction.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} blocked links.`, ephemeral: true });
      return;
    }

    if (group === 'greeting') {
      if (subcommand === 'disable') {
        updateGuildSettings(interaction.guild.id, (current) => ({ ...current, greeting: { ...(current.greeting || {}), enabled: false } }));
        await interaction.reply({ content: 'Greeting disabled.', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message', true);
      updateGuildSettings(interaction.guild.id, (current) => ({ ...current, greeting: { ...(current.greeting || {}), enabled: true, channelId: channel.id, message } }));
      await interaction.reply({ content: 'Greeting updated.', ephemeral: true });
      return;
    }

    if (group === 'protection') {
      if (subcommand === 'status') {
        const settings = getGuildSettings(interaction.guild.id);
        const protection = settings.protection || {};
        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('Protection Status').setDescription([
          `Enabled: ${protection.enabled !== false ? 'Yes' : 'No'}`,
          `Delete bad words: ${protection.deleteBadWords !== false ? 'Yes' : 'No'}`,
          `Delete links: ${protection.deleteLinks !== false ? 'Yes' : 'No'}`,
          `Timeout on words: ${protection.timeoutForWords !== false ? 'Yes' : 'No'}`,
          `Timeout on links: ${protection.timeoutForLinks !== false ? 'Yes' : 'No'}`,
          `Timeout minutes: ${protection.timeoutMinutes || 60}`,
          `Heat: ${protection.heatLevel || 0}/${protection.heatThreshold || 10}`,
          `Lockdown until: ${protection.lockdownUntil ? new Date(protection.lockdownUntil).toISOString() : 'Off'}`
        ].join('\n'));
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const updates = {
        enabled: interaction.options.getBoolean('enabled'),
        deleteBadWords: interaction.options.getBoolean('delete_words'),
        deleteLinks: interaction.options.getBoolean('delete_links'),
        timeoutForWords: interaction.options.getBoolean('timeout_words'),
        timeoutForLinks: interaction.options.getBoolean('timeout_links'),
        timeoutMinutes: interaction.options.getInteger('timeout_minutes'),
        heatThreshold: interaction.options.getInteger('heat_threshold'),
        lockdownMinutes: interaction.options.getInteger('lockdown_minutes')
      };

      updateGuildSettings(interaction.guild.id, (current) => ({
        ...current,
        protection: {
          ...(current.protection || {}),
          ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== null && value !== undefined))
        }
      }));

      await interaction.reply({ content: 'Protection settings updated.', ephemeral: true });
    }
  },
  async handleMessage(message, args = []) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const [group, subcommand, ...rest] = args.slice(1);

    if (group === 'words') {
      const settings = getGuildSettings(message.guild.id);
      const words = new Set(settings.blockedWords || []);

      if (subcommand === 'list') {
        await message.reply({ content: `Blocked words: ${[...words].slice(0, 50).join(', ')}${words.size > 50 ? ' ...' : ''}`, allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const inputWords = rest.join(' ').split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);
      for (const word of inputWords) {
        if (subcommand === 'add') {
          words.add(word);
        } else if (subcommand === 'remove') {
          words.delete(word);
        }
      }

      updateGuildSettings(message.guild.id, (current) => ({ ...current, blockedWords: [...words] }));
      await message.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} blocked words.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (group === 'links') {
      const settings = getGuildSettings(message.guild.id);
      const links = new Set(settings.blockedLinks || []);

      if (subcommand === 'list') {
        await message.reply({ content: `Blocked links: ${[...links].join(', ') || 'None'}`, allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const inputLinks = rest.join(' ').split(',').map((link) => link.trim().toLowerCase()).filter(Boolean);
      for (const link of inputLinks) {
        if (subcommand === 'add') {
          links.add(link);
        } else if (subcommand === 'remove') {
          links.delete(link);
        }
      }

      updateGuildSettings(message.guild.id, (current) => ({ ...current, blockedLinks: [...links] }));
      await message.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} blocked links.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (group === 'greeting') {
      if (subcommand === 'disable') {
        updateGuildSettings(message.guild.id, (current) => ({ ...current, greeting: { ...(current.greeting || {}), enabled: false } }));
        await message.reply({ content: 'Greeting disabled.', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const channel = message.mentions.channels.first();
      const greetingText = message.content.replace(/^\S+\s+\S+\s+\S+\s+<#\d+>\s*/i, '').trim();

      if (!channel || !greetingText) {
        await message.reply({ content: 'Usage: !config greeting set #channel message', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      updateGuildSettings(message.guild.id, (current) => ({ ...current, greeting: { ...(current.greeting || {}), enabled: true, channelId: channel.id, message: greetingText } }));
      await message.reply({ content: 'Greeting updated.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (group === 'protection') {
      if (subcommand === 'status') {
        const settings = getGuildSettings(message.guild.id);
        const protection = settings.protection || {};
        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('Protection Status').setDescription([
          `Enabled: ${protection.enabled !== false ? 'Yes' : 'No'}`,
          `Delete bad words: ${protection.deleteBadWords !== false ? 'Yes' : 'No'}`,
          `Delete links: ${protection.deleteLinks !== false ? 'Yes' : 'No'}`,
          `Timeout on words: ${protection.timeoutForWords !== false ? 'Yes' : 'No'}`,
          `Timeout on links: ${protection.timeoutForLinks !== false ? 'Yes' : 'No'}`,
          `Timeout minutes: ${protection.timeoutMinutes || 60}`,
          `Heat: ${protection.heatLevel || 0}/${protection.heatThreshold || 10}`,
          `Lockdown until: ${protection.lockdownUntil ? new Date(protection.lockdownUntil).toISOString() : 'Off'}`
        ].join('\n'));
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      if (subcommand === 'set') {
        const updates = Object.fromEntries(rest.map((pair) => {
          const [key, value] = pair.split('=');
          if (!key) {
            return [];
          }

          if (value === 'true' || value === 'false') {
            return [key, value === 'true'];
          }

          const numeric = Number(value);
          return [key, Number.isFinite(numeric) ? numeric : value];
        }).filter(([key]) => key));

        updateGuildSettings(message.guild.id, (current) => ({
          ...current,
          protection: {
            ...(current.protection || {}),
            enabled: updates.enabled ?? current.protection?.enabled,
            deleteBadWords: updates.delete_words ?? updates.deleteBadWords ?? current.protection?.deleteBadWords,
            deleteLinks: updates.delete_links ?? updates.deleteLinks ?? current.protection?.deleteLinks,
            timeoutForWords: updates.timeout_words ?? updates.timeoutForWords ?? current.protection?.timeoutForWords,
            timeoutForLinks: updates.timeout_links ?? updates.timeoutForLinks ?? current.protection?.timeoutForLinks,
            timeoutMinutes: updates.timeout_minutes ?? updates.timeoutMinutes ?? current.protection?.timeoutMinutes,
            heatThreshold: updates.heat_threshold ?? updates.heatThreshold ?? current.protection?.heatThreshold,
            lockdownMinutes: updates.lockdown_minutes ?? updates.lockdownMinutes ?? current.protection?.lockdownMinutes
          }
        }));

        await message.reply({ content: 'Protection settings updated.', allowedMentions: { repliedUser: false } }).catch(() => null);
      }
    }
  }
};