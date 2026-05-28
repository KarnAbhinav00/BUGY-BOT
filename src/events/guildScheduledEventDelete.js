const { setContextPresence } = require('../utils/presence');

module.exports = {
  name: 'guildScheduledEventDelete',
  async execute(client, event) {
    setContextPresence(client, 'watching BUG EMPIRE');
  }
};