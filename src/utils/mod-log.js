const { EmbedBuilder } = require('discord.js');

function buildModerationEmbed({ action, target, moderator, reason, duration, channel, extra }) {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`Moderation Action: ${action}`)
    .addFields(
      { name: 'Target', value: target || 'Unknown', inline: true },
      { name: 'Moderator', value: moderator || 'Unknown', inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false },
      { name: 'Duration', value: duration || 'N/A', inline: true },
      { name: 'Channel', value: channel || 'N/A', inline: true }
    )
    .setTimestamp();

  if (extra) {
    embed.addFields({ name: 'Extra', value: extra, inline: false });
  }

  return embed;
}

async function logModerationAction(guild, settings, data) {
  if (!guild || !settings || !data) {
    return;
  }

  const logChannelId = settings.moderationLogChannelId || settings.protection?.logChannelId;
  if (!logChannelId) {
    return;
  }

  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel?.isTextBased()) {
    return;
  }

  const embed = buildModerationEmbed(data);
  await logChannel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
  logModerationAction
};
