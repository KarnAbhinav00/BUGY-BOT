const { setContextPresence } = require('../utils/presence');

module.exports = {
  name: 'guildScheduledEventCreate',
  async execute(client, event) {
    setContextPresence(client, 'managing the event');
  }
};