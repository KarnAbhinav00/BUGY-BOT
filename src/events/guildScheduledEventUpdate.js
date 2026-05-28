const { setContextPresence } = require('../utils/presence');

module.exports = {
  name: 'guildScheduledEventUpdate',
  async execute(client, oldEvent, newEvent) {
    setContextPresence(client, 'managing the event');
  }
};