const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { timeoutMember } = require('../utils/mod-actions');

function parseReason(message) {
  return message.content.replace(/^\S+\s+<@!?\d+>\s*\S+\s*/i, '').trim() || 'No reason provided';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .addUserOption((option) => option.setName('user').setDescription('User to timeout').setRequired(true))
    .addStringOption((option) => option.setName('time').setDescription('Duration like 2d, 12h, 30m').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: 'You need Moderate Members to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const time = interaction.options.getString('time', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
      return;
    }

    await timeoutMember(member, time, reason);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Member timed out').setDescription(`User: ${user.tag}\nTime: ${time}\nReason: ${reason}`)], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply({ content: 'You need Moderate Members to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const user = message.mentions.users.first();
    const timeMatch = message.content.match(/\b(\d+[smhd]|455d|perm|permanent|forever)\b/i);

    if (!user || !timeMatch) {
      await message.reply({ content: 'Usage: !timeout @user 2d reason', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await message.reply({ content: 'That user is not in the server.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const time = timeMatch[1];
    const reason = parseReason(message);
    await timeoutMember(member, time, reason);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Member timed out').setDescription(`User: ${user.tag}\nTime: ${time}\nReason: ${reason}`)], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};