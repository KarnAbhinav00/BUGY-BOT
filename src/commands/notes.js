const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

function getNotes(settings, userId) {
  return settings.notes?.[userId] || [];
}

function setNotes(guildId, userId, notes) {
  updateGuildSettings(guildId, (current) => ({
    ...current,
    notes: {
      ...(current.notes || {}),
      [userId]: notes
    }
  }));
}

function buildNotesEmbed(userTag, notes) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📝 Notes for ${userTag}`)
    .setDescription(notes.length ? notes.map((entry, index) => `${index + 1}. ${entry}`).join('\n') : 'No notes stored.')
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('Store and view staff notes on members.')
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add a note to a member.')
      .addUserOption((option) => option.setName('user').setDescription('Member to note').setRequired(true))
      .addStringOption((option) => option.setName('text').setDescription('Note text').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('List notes for a member.')
      .addUserOption((option) => option.setName('user').setDescription('Member to inspect').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove a note by index.')
      .addUserOption((option) => option.setName('user').setDescription('Member to inspect').setRequired(true))
      .addIntegerOption((option) => option.setName('index').setDescription('1-based note index').setMinValue(1).setRequired(true))),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user', true);
    const settings = getGuildSettings(interaction.guild.id);
    const currentNotes = getNotes(settings, targetUser.id);

    if (subcommand === 'list') {
      await interaction.reply({ embeds: [buildNotesEmbed(targetUser.tag, currentNotes)], ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      const text = interaction.options.getString('text', true);
      const nextNotes = [...currentNotes, `[${interaction.user.tag}] ${text}`];
      setNotes(interaction.guild.id, targetUser.id, nextNotes);
      await interaction.reply({ content: `Added a note for ${targetUser.tag}.`, ephemeral: true });
      return;
    }

    const index = interaction.options.getInteger('index', true) - 1;
    if (!currentNotes[index]) {
      await interaction.reply({ content: 'That note index does not exist.', ephemeral: true });
      return;
    }

    const nextNotes = currentNotes.filter((_, noteIndex) => noteIndex !== index);
    setNotes(interaction.guild.id, targetUser.id, nextNotes);
    await interaction.reply({ content: `Removed note ${index + 1} for ${targetUser.tag}.`, ephemeral: true });
  },
  async handleMessage(message) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const [, subcommandRaw, secondArgRaw, ...textParts] = message.content.trim().split(/\s+/);
    const subcommand = (subcommandRaw || 'list').toLowerCase();
    const targetUser = message.mentions.users.first();
    const settings = getGuildSettings(message.guild.id);

    if (!targetUser) {
      await message.reply({ content: 'Usage: !notes add @user text | !notes list @user | !notes remove @user 1', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const currentNotes = getNotes(settings, targetUser.id);

    if (subcommand === 'list') {
      await message.reply({ embeds: [buildNotesEmbed(targetUser.tag, currentNotes)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'add') {
      const text = textParts.join(' ').trim();
      if (!text) {
        await message.reply({ content: 'Usage: !notes add @user text', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const nextNotes = [...currentNotes, `[${message.author.tag}] ${text}`];
      setNotes(message.guild.id, targetUser.id, nextNotes);
      await message.reply({ content: `Added a note for ${targetUser.tag}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'remove') {
      const index = Number(textParts[0] || secondArgRaw) - 1;
      if (!Number.isFinite(index) || !currentNotes[index]) {
        await message.reply({ content: 'That note index does not exist.', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const nextNotes = currentNotes.filter((_, noteIndex) => noteIndex !== index);
      setNotes(message.guild.id, targetUser.id, nextNotes);
      await message.reply({ content: `Removed note ${index + 1} for ${targetUser.tag}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
    }
  }
};
