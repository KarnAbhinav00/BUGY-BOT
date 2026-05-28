const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const { getGuildSettings } = require('../storage/guild-settings');
const { getTicketRecord } = require('./ticket-history');

async function fetchAllMessages(channel) {
  const messages = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);

    if (!batch || !batch.size) {
      break;
    }

    messages.push(...batch.values());
    before = batch.last().id;

    if (batch.size < 100) {
      break;
    }
  }

  return messages.sort((left, right) => left.createdTimestamp - right.createdTimestamp);
}

function formatMessage(message) {
  const timestamp = new Date(message.createdTimestamp).toISOString();
  const parts = [`[${timestamp}] ${message.author.tag}: ${message.content || '(no text)'}`];

  if (message.attachments.size) {
    parts.push(`Attachments: ${[...message.attachments.values()].map((attachment) => attachment.url).join(', ')}`);
  }

  if (message.embeds.length) {
    for (const embed of message.embeds) {
      const embedBits = [];

      if (embed.title) {
        embedBits.push(`Title: ${embed.title}`);
      }

      if (embed.description) {
        embedBits.push(`Description: ${embed.description}`);
      }

      if (embedBits.length) {
        parts.push(embedBits.join(' | '));
      }
    }
  }

  return parts.join('\n');
}

function formatTicketEvent(event) {
  const timestamp = new Date(event.timestamp || Date.now()).toISOString();

  if (event.type === 'message') {
    const attachments = event.attachments?.length ? `\nAttachments: ${event.attachments.join(', ')}` : '';
    return `[${timestamp}] ${event.authorTag || event.authorId}: ${event.content || '(no text)'}${attachments}`;
  }

  if (event.type === 'edit') {
    return [`[${timestamp}] EDIT ${event.authorTag || event.authorId}: ${event.before || '(no text)'}`, `After: ${event.after || '(no text)'}`].join('\n');
  }

  if (event.type === 'delete') {
    return `[${timestamp}] DELETE ${event.authorTag || event.authorId}: ${event.content || '(no text)'}`;
  }

  return `[${timestamp}] ${event.type || 'event'}`;
}

async function buildTranscript(channel) {
  await fs.mkdir(config.transcriptsDir, { recursive: true });

  const messages = await fetchAllMessages(channel);
  const settings = getGuildSettings(channel.guild.id);
  const ticketRecord = getTicketRecord(settings, channel.id);
  const ticketEvents = [...(ticketRecord?.events || [])].sort((left, right) => (left.timestamp || 0) - (right.timestamp || 0));
  const lines = [
    `Transcript for #${channel.name}`,
    `Channel ID: ${channel.id}`,
    `Guild: ${channel.guild.name}`,
    `Created: ${new Date().toISOString()}`,
    ticketRecord?.reason ? `Reason: ${ticketRecord.reason}` : null,
    ticketRecord?.ownerTag ? `Owner: ${ticketRecord.ownerTag}` : null,
    '',
    ticketEvents.length ? 'Ticket history:' : null,
    ...ticketEvents.map((event) => formatTicketEvent(event)),
    ticketEvents.length ? '' : null,
    ...messages.map((message) => formatMessage(message)),
    ''
  ].filter(Boolean);

  const filePath = path.join(config.transcriptsDir, `${channel.id}-${Date.now()}.txt`);
  await fs.writeFile(filePath, lines.join('\n\n'), 'utf8');

  return {
    filePath,
    messageCount: messages.length
  };
}

module.exports = {
  buildTranscript
};