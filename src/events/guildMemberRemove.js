const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');

function applyTemplate(template, user, guild) {
  return String(template || '')
    .replaceAll('{user}', `${user.tag}`)
    .replaceAll('{username}', user.username)
    .replaceAll('{server}', guild.name);
}

module.exports = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    const settings = getGuildSettings(member.guild.id);

    if (!settings.leaveChannelId) {
      return;
    }

    const channel = member.guild.channels.cache.get(settings.leaveChannelId);

    if (!channel?.isTextBased()) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`Goodbye from ${member.guild.name}`)
      .setDescription(applyTemplate(settings.leaveMessage, member.user, member.guild))
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => null);
  }
};