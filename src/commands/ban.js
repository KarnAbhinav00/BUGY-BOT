const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { banMember } = require('../utils/mod-actions');

function parseTargetAndReason(message) {
  const user = message.mentions.users.first();
  const timeMatch = message.content.match(/\b(\d+[smhd]|455d|perm|permanent|forever)\b/i);
  const reason = message.content
    .replace(/^\S+\s+<@!?\d+>\s*/i, '')
    .replace(/\b(\d+[smhd]|455d|perm|permanent|forever)\b/i, '')
    .trim();

  return { user, time: timeMatch?.[1] || '455d', reason: reason || 'No reason provided' };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member.')
    .addUserOption((option) => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true))
    .addStringOption((option) => option.setName('time').setDescription('Use 455d for permanent or a duration like 2d, 12h, 30m').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
      await interaction.reply({ content: 'You need Ban Members to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const time = interaction.options.getString('time', true);

    const result = await banMember(interaction, user, time, reason);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Ban issued')
      .setDescription(`User: ${user.tag}\nDuration: ${result.durationLabel}\nReason: ${reason}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await message.reply({ content: 'You need Ban Members to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const { user, time, reason } = parseTargetAndReason(message);

    if (!user) {
      await message.reply({ content: 'Usage: !ban @user 455d reason', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const result = await banMember(message, user, time, reason);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Ban issued')
      .setDescription(`User: ${user.tag}\nDuration: ${result.durationLabel}\nReason: ${reason}`);

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};