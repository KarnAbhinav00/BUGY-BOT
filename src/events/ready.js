module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    const { startPresenceRotation } = require('../utils/presence');
    const { runTicketInactivitySweep } = require('../utils/ticket-inactivity');
    const { setInterval: setNodeInterval } = global;
    startPresenceRotation(client);
    setNodeInterval(() => {
      runTicketInactivitySweep(client).catch((error) => console.error('Ticket inactivity sweep failed:', error));
    }, 60 * 1000);
  }
};