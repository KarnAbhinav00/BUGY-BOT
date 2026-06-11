const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

function buildServerStatsEmbed(guild) {
  const textChannels = guild.channels.cache.filter((channel) => channel.type === 0 || channel.type === 5).size;
  const voiceChannels = guild.channels.cache.filter((channel) => channel.type === 2).size;
  const categories = guild.channels.cache.filter((channel) => channel.type === 4).size;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 ${guild.name} Server Stats`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Members', value: `${guild.memberCount}`, inline: true },
      { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
      { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Text Channels', value: `${textChannels}`, inline: true },
      { name: 'Voice Channels', value: `${voiceChannels}`, inline: true },
      { name: 'Categories', value: `${categories}`, inline: true }
    )
    .setFooter({ text: `Server ID: ${guild.id}` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Show detailed server stats.'),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [buildServerStatsEmbed(interaction.guild)], ephemeral: true });
  },
  async handleMessage(message) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    await message.reply({ embeds: [buildServerStatsEmbed(message.guild)], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
