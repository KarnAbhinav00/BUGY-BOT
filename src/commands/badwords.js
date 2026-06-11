const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings, updateGuildSettings, defaultGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

function normalizeListInput(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function buildBadWordsEmbed(settings) {
  const words = settings.blockedWords || [];
  const links = settings.blockedLinks || [];

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🚫 Banned Words List')
    .setDescription('Manage the server filter list from one command.')
    .addFields(
      { name: 'Blocked Words', value: words.length ? words.slice(0, 100).join(', ') : 'None', inline: false },
      { name: 'Blocked Links', value: links.length ? links.slice(0, 100).join(', ') : 'None', inline: false }
    )
    .setFooter({ text: `Total words: ${words.length} | Total links: ${links.length}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badwords')
    .setDescription('View and manage banned words and links.')
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('Show blocked words and links.'))
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add blocked words.')
      .addStringOption((option) => option.setName('words').setDescription('Comma-separated words').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove blocked words.')
      .addStringOption((option) => option.setName('words').setDescription('Comma-separated words').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('clear')
      .setDescription('Clear the blocked words list.'))
    .addSubcommand((subcommand) => subcommand
      .setName('reset')
      .setDescription('Restore the preset banned words and links.')),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const settings = getGuildSettings(interaction.guild.id);

    if (subcommand === 'list') {
      await interaction.reply({ embeds: [buildBadWordsEmbed(settings)], ephemeral: true });
      return;
    }

    if (subcommand === 'clear') {
      updateGuildSettings(interaction.guild.id, (current) => ({
        ...current,
        blockedWords: [],
        blockedLinks: current.blockedLinks || []
      }));

      await interaction.reply({ content: 'Cleared the blocked words list.', ephemeral: true });
      return;
    }

    if (subcommand === 'reset') {
      updateGuildSettings(interaction.guild.id, (current) => ({
        ...current,
        blockedWords: [...new Set([...(defaultGuildSettings.blockedWords || [])])],
        blockedLinks: [...new Set([...(defaultGuildSettings.blockedLinks || [])])]
      }));

      await interaction.reply({ content: 'Restored the preset banned words and links.', ephemeral: true });
      return;
    }

    const input = normalizeListInput(interaction.options.getString('words', true));

    updateGuildSettings(interaction.guild.id, (current) => {
      const blockedWords = new Set(current.blockedWords || []);

      for (const word of input) {
        if (subcommand === 'add') {
          blockedWords.add(word);
        } else {
          blockedWords.delete(word);
        }
      }

      return {
        ...current,
        blockedWords: [...blockedWords]
      };
    });

    await interaction.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} banned words.`, ephemeral: true });
  },
  async handleMessage(message, args = []) {
    const settings = getGuildSettings(message.guild.id);
    const subcommand = (args[1] || 'list').toLowerCase();

    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'list') {
      await message.reply({ embeds: [buildBadWordsEmbed(settings)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'clear') {
      updateGuildSettings(message.guild.id, (current) => ({
        ...current,
        blockedWords: [],
        blockedLinks: current.blockedLinks || []
      }));

      await message.reply({ content: 'Cleared the blocked words list.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'reset') {
      updateGuildSettings(message.guild.id, (current) => ({
        ...current,
        blockedWords: [...new Set([...(defaultGuildSettings.blockedWords || [])])],
        blockedLinks: [...new Set([...(defaultGuildSettings.blockedLinks || [])])]
      }));

      await message.reply({ content: 'Restored the preset banned words and links.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const input = normalizeListInput(message.content.replace(/^\S+\s+\S+\s*/, ''));

    if (!input.length) {
      await message.reply({ content: 'Usage: !badwords add word1, word2 | !badwords remove word1, word2', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    updateGuildSettings(message.guild.id, (current) => {
      const blockedWords = new Set(current.blockedWords || []);

      for (const word of input) {
        if (subcommand === 'add') {
          blockedWords.add(word);
        } else {
          blockedWords.delete(word);
        }
      }

      return {
        ...current,
        blockedWords: [...blockedWords]
      };
    });

    await message.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} banned words.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
