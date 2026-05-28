const { getGuildSettings } = require('../storage/guild-settings');
const { appendTicketEvent, getTicketRecord, isTicketChannel } = require('../utils/ticket-history');

module.exports = {
  name: 'messageDelete',
  async execute(client, message) {
    if (!message?.channel?.guild || !isTicketChannel(message.channel)) {
      return;
    }

    const settings = getGuildSettings(message.channel.guild.id);
    const ticketRecord = getTicketRecord(settings, message.channel.id);
    if (!ticketRecord) {
      return;
    }

    appendTicketEvent(message.channel.guild.id, message.channel.id, {
      type: 'delete',
      messageId: message.id,
      authorId: message.author?.id,
      authorTag: message.author?.tag,
      content: message.content || '',
      timestamp: Date.now()
    });
  }
};