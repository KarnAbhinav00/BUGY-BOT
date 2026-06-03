const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

function formatTimestamp(timestamp) {
  return timestamp ? `<t:${Math.floor(timestamp / 1000)}:F>` : 'Unknown';
}

function getMemberFromMessage(message) {
  const mention = message.mentions.users.first();
  const rawId = message.content.split(/\s+/)[1];
  const userId = mention?.id || (rawId && rawId.match(/^<@!?(\d+)>$/) ? rawId.match(/^<@!?(\d+)>$/)[1] : rawId);
  return userId ? message.guild.members.fetch(userId).catch(() => null) : Promise.resolve(message.member);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Show information about a server member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to inspect').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const member = targetUser
      ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      : interaction.member;

    if (!member) {
      await interaction.reply({ content: 'That member could not be found.', ephemeral: true });
      return;
    }

    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guild.id)
      .sort((left, right) => right.position - left.position)
      .map((role) => `<@&${role.id}>`)
      .slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor(member.displayHexColor || 0x5865f2)
      .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 512 }))
      .setTitle(`👤 Whois: ${member.user.tag}`)
      .addFields(
        { name: 'User ID', value: member.id, inline: true },
        { name: 'Bot', value: member.user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Nickname', value: member.nickname || 'None', inline: true },
        { name: 'Joined server', value: formatTimestamp(member.joinedTimestamp), inline: true },
        { name: 'Account created', value: formatTimestamp(member.user.createdTimestamp), inline: true },
        { name: 'Highest role', value: member.roles.highest?.name || 'None', inline: true },
        { name: `Roles (${roles.length})`, value: roles.length ? roles.join(' ') : 'None', inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    const member = await getMemberFromMessage(message);
    if (!member) {
      await message.reply({ content: 'Usage: ?whois @user or ?whois userId', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const roles = member.roles.cache
      .filter((role) => role.id !== message.guild.id)
      .sort((left, right) => right.position - left.position)
      .map((role) => `<@&${role.id}>`)
      .slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor(member.displayHexColor || 0x5865f2)
      .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 512 }))
      .setTitle(`👤 Whois: ${member.user.tag}`)
      .addFields(
        { name: 'User ID', value: member.id, inline: true },
        { name: 'Bot', value: member.user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Nickname', value: member.nickname || 'None', inline: true },
        { name: 'Joined server', value: formatTimestamp(member.joinedTimestamp), inline: true },
        { name: 'Account created', value: formatTimestamp(member.user.createdTimestamp), inline: true },
        { name: 'Highest role', value: member.roles.highest?.name || 'None', inline: true },
        { name: `Roles (${roles.length})`, value: roles.length ? roles.join(' ') : 'None', inline: false }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
