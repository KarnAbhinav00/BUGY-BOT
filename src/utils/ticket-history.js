const { updateGuildSettings } = require('../storage/guild-settings');

function getTicketRecord(settings, channelId) {
  return settings.ticket?.tickets?.[channelId] || null;
}

function upsertTicketRecord(guildId, channelId, patch) {
  updateGuildSettings(guildId, (settings) => ({
    ...settings,
    ticket: {
      ...settings.ticket,
      tickets: {
        ...(settings.ticket.tickets || {}),
        [channelId]: {
          ...(settings.ticket.tickets?.[channelId] || {}),
          ...patch
        }
      }
    }
  }));
}

function appendTicketEvent(guildId, channelId, event) {
  updateGuildSettings(guildId, (settings) => {
    const currentRecord = settings.ticket.tickets?.[channelId] || {};

    return {
      ...settings,
      ticket: {
        ...settings.ticket,
        tickets: {
          ...(settings.ticket.tickets || {}),
          [channelId]: {
            ...currentRecord,
            participants: [...new Set([...(currentRecord.participants || []), event.authorId].filter(Boolean))],
            events: [...(currentRecord.events || []), event]
          }
        }
      }
    };
  });
}

function touchTicketActivity(guildId, channelId) {
  updateGuildSettings(guildId, (settings) => {
    const currentRecord = settings.ticket.tickets?.[channelId] || {};

    return {
      ...settings,
      ticket: {
        ...settings.ticket,
        tickets: {
          ...(settings.ticket.tickets || {}),
          [channelId]: {
            ...currentRecord,
            lastActivityAt: Date.now(),
            inactivityReminderAt: null,
            inactivityReminderExpiresAt: null
          }
        }
      }
    };
  });
}

function setTicketReminder(guildId, channelId, reminderPatch) {
  updateGuildSettings(guildId, (settings) => {
    const currentRecord = settings.ticket.tickets?.[channelId] || {};

    return {
      ...settings,
      ticket: {
        ...settings.ticket,
        tickets: {
          ...(settings.ticket.tickets || {}),
          [channelId]: {
            ...currentRecord,
            ...reminderPatch
          }
        }
      }
    };
  });
}

function clearTicketRecord(guildId, channelId) {
  updateGuildSettings(guildId, (settings) => {
    const nextTickets = { ...(settings.ticket.tickets || {}) };
    delete nextTickets[channelId];

    return {
      ...settings,
      ticket: {
        ...settings.ticket,
        tickets: nextTickets
      }
    };
  });
}

function isTicketChannel(channel) {
  return Boolean(channel?.topic?.startsWith('ticket-owner:'));
}

module.exports = {
  appendTicketEvent,
  clearTicketRecord,
  getTicketRecord,
  isTicketChannel,
  setTicketReminder,
  touchTicketActivity,
  upsertTicketRecord
};