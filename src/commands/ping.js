const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requestFooter } = require('../utils/embed');

function buildPingEmbed(interactionUser, latency) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('EmpireGuard')
    .setDescription(`Pong. WebSocket latency: ${latency}ms`)
    .setFooter(requestFooter(interactionUser));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency.'),
  async execute(interaction) {
    await interaction.reply({ embeds: [buildPingEmbed(interaction.user.username, interaction.client.ws.ping)], ephemeral: true });
  },
  async handleMessage(message) {
    await message.reply({ embeds: [buildPingEmbed(message.author.username, message.client.ws.ping)] }).catch(() => null);
  }
};