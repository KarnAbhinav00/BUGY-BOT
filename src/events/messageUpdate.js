const { getGuildSettings } = require('../storage/guild-settings');
const { appendTicketEvent, getTicketRecord, isTicketChannel } = require('../utils/ticket-history');

module.exports = {
  name: 'messageUpdate',
  async execute(client, oldMessage, newMessage) {
    const channel = newMessage?.channel || oldMessage?.channel;
    if (!channel?.guild || !isTicketChannel(channel)) {
      return;
    }

    const settings = getGuildSettings(channel.guild.id);
    const ticketRecord = getTicketRecord(settings, channel.id);
    if (!ticketRecord) {
      return;
    }

    const before = oldMessage?.content || '';
    const after = newMessage?.content || '';
    if (before === after) {
      return;
    }

    appendTicketEvent(channel.guild.id, channel.id, {
      type: 'edit',
      messageId: newMessage?.id || oldMessage?.id,
      authorId: newMessage?.author?.id || oldMessage?.author?.id,
      authorTag: newMessage?.author?.tag || oldMessage?.author?.tag,
      before,
      after,
      timestamp: Date.now()
    });
  }
};