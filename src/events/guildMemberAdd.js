const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');

function applyTemplate(template, member) {
  return String(template || '')
    .replaceAll('{user}', `${member}`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    const settings = getGuildSettings(member.guild.id);
    const greeting = settings.greeting || {};
    const greetingChannelId = greeting.enabled === false ? '' : greeting.channelId || settings.welcomeChannelId;
    const greetingMessage = greeting.message || settings.welcomeMessage;

    for (const roleId of settings.autoroleIds || []) {
      await member.roles.add(roleId).catch(() => null);
    }

    if (!greetingChannelId) {
      return;
    }

    const channel = member.guild.channels.cache.get(greetingChannelId);

    if (!channel?.isTextBased()) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`Welcome to ${member.guild.name}`)
      .setDescription(applyTemplate(greetingMessage, member))
      .setThumbnail(member.user.displayAvatarURL({ size: 128, dynamic: true }))
      .setImage('https://klipy.com/gifs/welcome-minecraft-1')
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => null);
  }
};