const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');

function normalizePrefix(value) {
  return String(value || '').trim();
}

function normalizePrefixes(prefixes) {
  return [...new Set((prefixes || []).map((prefix) => normalizePrefix(prefix)).filter(Boolean))];
}

function updateGuildPrefixes(guildId, updater) {
  return updateGuildSettings(guildId, (settings) => {
    const current = Array.isArray(settings.prefixes) && settings.prefixes.length
      ? settings.prefixes
      : [settings.prefix || '!'];

    const next = typeof updater === 'function' ? updater(normalizePrefixes(current)) : updater;
    const prefixes = normalizePrefixes(next);

    return {
      ...settings,
      prefixes,
      prefix: prefixes[0] || settings.prefix || '!'
    };
  });
}

function buildPrefixesEmbed(settings, username) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📌 Prefix configuration')
    .setDescription(`Current prefixes: ${normalizePrefixes(settings.prefixes).map((prefix) => `\`${prefix}\``).join(' • ') || '`!`'}`)
    .setFooter({ text: `Requested by ${username}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Manage the bot prefixes for this guild.')
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('List all configured prefixes.'))
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add a new prefix.')
      .addStringOption((option) => option.setName('value').setDescription('Prefix to add').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove an existing prefix.')
      .addStringOption((option) => option.setName('value').setDescription('Prefix to remove').setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const value = normalizePrefix(interaction.options.getString('value'));
    const settings = getGuildSettings(interaction.guild.id);

    if (subcommand === 'list') {
      await interaction.reply({ embeds: [buildPrefixesEmbed(settings)], ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      if (!value) {
        await interaction.reply({ content: 'Please provide a valid prefix to add.', ephemeral: true });
        return;
      }

      const updated = updateGuildPrefixes(interaction.guild.id, (prefixes) => [...prefixes, value]);
      await interaction.reply({ content: `Added prefix **${value}**. Current prefixes: ${updated.prefixes.map((p) => `\`${p}\``).join(' • ')}`, ephemeral: true });
      return;
    }

    if (subcommand === 'remove') {
      if (!value) {
        await interaction.reply({ content: 'Please provide a valid prefix to remove.', ephemeral: true });
        return;
      }

      const updated = updateGuildPrefixes(interaction.guild.id, (prefixes) => prefixes.filter((prefix) => prefix !== value));
      if (!updated.prefixes.includes(value)) {
        await interaction.reply({ content: `Removed prefix **${value}**. Current prefixes: ${updated.prefixes.map((p) => `\`${p}\``).join(' • ') || 'none'}.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Prefix **${value}** was not configured.`, ephemeral: true });
      }
    }
  },
  async handleMessage(message, args = []) {
    const rawSubcommand = args[1]?.toLowerCase() || 'list';
    const value = normalizePrefix(args.slice(2).join(' '));
    const settings = getGuildSettings(message.guild.id);
    const actionMap = {
      add: 'add',
      remove: 'remove',
      list: 'list',
      show: 'list',
      addprefix: 'add',
      removeprefix: 'remove',
      listprefix: 'list'
    };
    const subcommand = actionMap[rawSubcommand] || rawSubcommand;

    if (subcommand === 'list') {
      await message.reply({ embeds: [buildPrefixesEmbed(settings)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'add') {
      if (!value) {
        await message.reply({ content: 'Usage: !prefix add <prefix>', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const updated = updateGuildPrefixes(message.guild.id, (prefixes) => [...prefixes, value]);
      await message.reply({ content: `Added prefix **${value}**. Current prefixes: ${updated.prefixes.map((p) => `\`${p}\``).join(' • ')}`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'remove') {
      if (!value) {
        await message.reply({ content: 'Usage: !prefix remove <prefix>', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const updated = updateGuildPrefixes(message.guild.id, (prefixes) => prefixes.filter((prefix) => prefix !== value));
      await message.reply({ content: `Removed prefix **${value}**. Current prefixes: ${updated.prefixes.map((p) => `\`${p}\``).join(' • ') || 'none'}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    await message.reply({ content: 'Unknown prefix command. Use `!prefix list`, `!prefix add <prefix>`, or `!prefix remove <prefix>`.', allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
