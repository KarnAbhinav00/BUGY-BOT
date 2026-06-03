const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { parseDuration } = require('../utils/mod-actions');

function parseDurationMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.round(value);
  }

  const durationMs = parseDuration(String(value));
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 60;
  }

  return Math.max(1, Math.round(durationMs / 60_000));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Moderation tools.')
    .addSubcommand((subcommand) => subcommand
      .setName('timeout')
      .setDescription('Timeout a member.')
      .addUserOption((option) => option.setName('user').setDescription('User to timeout').setRequired(true))
      .addIntegerOption((option) => option.setName('minutes').setDescription('Timeout length in minutes').setMinValue(1).setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('ban')
      .setDescription('Ban a member.')
      .addUserOption((option) => option.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('kick')
      .setDescription('Kick a member.')
      .addUserOption((option) => option.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('purge')
      .setDescription('Delete recent messages.')
      .addIntegerOption((option) => option.setName('amount').setDescription('Messages to delete').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('warn')
      .setDescription('Warn a member.')
      .addUserOption((option) => option.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('badword-add')
      .setDescription('Add a blocked word.')
      .addStringOption((option) => option.setName('word').setDescription('Word to block').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('badword-remove')
      .setDescription('Remove a blocked word.')
      .addStringOption((option) => option.setName('word').setDescription('Word to remove').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('badword-list')
      .setDescription('List blocked words.'))
    .addSubcommand((subcommand) => subcommand
      .setName('setlog')
      .setDescription('Set the moderation log channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Log channel').setRequired(true))),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: 'You need moderation permissions to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setlog') {
      const channel = interaction.options.getChannel('channel', true);
      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        moderationLogChannelId: channel.id
      }));

      await interaction.reply({ content: `Moderation log channel set to ${channel}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'badword-list') {
      const settings = getGuildSettings(interaction.guild.id);
      const words = settings.blockedWords.length ? settings.blockedWords.join(', ') : 'No blocked words configured.';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Blocked words').setDescription(words)], ephemeral: true });
      return;
    }

    if (subcommand === 'badword-add' || subcommand === 'badword-remove') {
      const word = interaction.options.getString('word', true).trim().toLowerCase();
      updateGuildSettings(interaction.guild.id, (settings) => {
        const blockedWords = new Set(settings.blockedWords || []);

        if (subcommand === 'badword-add') {
          blockedWords.add(word);
        } else {
          blockedWords.delete(word);
        }

        return {
          ...settings,
          blockedWords: [...blockedWords]
        };
      });

      await interaction.reply({ content: `${subcommand === 'badword-add' ? 'Added' : 'Removed'} blocked word: ${word}`, ephemeral: true });
      return;
    }

    if (subcommand === 'purge') {
      const amount = interaction.options.getInteger('amount', true);
      const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
      await interaction.reply({ content: `Deleted ${deleted?.size || 0} messages.`, ephemeral: true });
      return;
    }

    const member = interaction.options.getMember('user');
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (subcommand === 'timeout') {
      const minutes = parseDurationMinutes(interaction.options.getInteger('minutes', true));
      await member.timeout(minutes * 60_000, reason).catch(() => null);
      await interaction.reply({ content: `Timed out ${user.tag} for ${minutes} minutes.`, ephemeral: true });
      return;
    }

    if (subcommand === 'ban') {
      await interaction.guild.members.ban(user.id, { reason }).catch(() => null);
      await interaction.reply({ content: `Banned ${user.tag}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'kick') {
      await member.kick(reason).catch(() => null);
      await interaction.reply({ content: `Kicked ${user.tag}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'warn') {
      const settings = getGuildSettings(interaction.guild.id);
      const logChannel = settings.moderationLogChannelId ? interaction.guild.channels.cache.get(settings.moderationLogChannelId) : null;
      const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Warning issued').setDescription(`Member: ${user.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`);

      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed] }).catch(() => null);
      }

      await interaction.reply({ content: `Warned ${user.tag}.`, ephemeral: true });
    }
  },
  async handleMessage(message, args = []) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply({ content: 'You need moderation permissions to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const subcommand = args[1];
    const user = message.mentions.users.first();
    const member = user ? await message.guild.members.fetch(user.id).catch(() => null) : null;
    const reason = message.content.split(/\s+/).slice(3).join(' ') || 'No reason provided';

    if (subcommand === 'setlog') {
      const channel = message.mentions.channels.first();
      if (!channel) {
        await message.reply({ content: 'Usage: !moderation setlog #channel', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      updateGuildSettings(message.guild.id, (settings) => ({
        ...settings,
        moderationLogChannelId: channel.id
      }));

      await message.reply({ content: `Moderation log channel set to ${channel}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'badword-list') {
      const settings = getGuildSettings(message.guild.id);
      const words = settings.blockedWords.length ? settings.blockedWords.join(', ') : 'No blocked words configured.';
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Blocked words').setDescription(words)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'badword-add' || subcommand === 'badword-remove') {
      const word = message.content.split(/\s+/).slice(2).join(' ').trim().toLowerCase();
      if (!word) {
        await message.reply({ content: 'Usage: !moderation badword-add word', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      updateGuildSettings(message.guild.id, (settings) => {
        const blockedWords = new Set(settings.blockedWords || []);
        if (subcommand === 'badword-add') {
          blockedWords.add(word);
        } else {
          blockedWords.delete(word);
        }

        return {
          ...settings,
          blockedWords: [...blockedWords]
        };
      });

      await message.reply({ content: `${subcommand === 'badword-add' ? 'Added' : 'Removed'} blocked word: ${word}`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'purge') {
      const amount = Number(args[2]);
      const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
      await message.reply({ content: `Deleted ${deleted?.size || 0} messages.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (!member || !user) {
      await message.reply({ content: 'Usage: !moderation timeout @user minutes [reason] | ban @user [reason] | kick @user [reason] | warn @user reason', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'timeout') {
      const minutes = parseDurationMinutes(args[2]);
      await member.timeout(minutes * 60_000, reason).catch(() => null);
      await message.reply({ content: `Timed out ${user.tag} for ${minutes} minutes.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'ban') {
      await message.guild.members.ban(user.id, { reason }).catch(() => null);
      await message.reply({ content: `Banned ${user.tag}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'kick') {
      await member.kick(reason).catch(() => null);
      await message.reply({ content: `Kicked ${user.tag}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'warn') {
      const settings = getGuildSettings(message.guild.id);
      const logChannel = settings.moderationLogChannelId ? message.guild.channels.cache.get(settings.moderationLogChannelId) : null;
      const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Warning issued').setDescription(`Member: ${user.tag}\nModerator: ${message.author.tag}\nReason: ${reason}`);

      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed] }).catch(() => null);
      }

      await message.reply({ content: `Warned ${user.tag}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
    }
  }
};