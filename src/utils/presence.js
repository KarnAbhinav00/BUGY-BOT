const { ActivityType } = require('discord.js');

const presenceList = [
  { name: 'EmpireGuard monitoring BUG EMPIRE', type: ActivityType.Watching },
  { name: 'tickets and reports', type: ActivityType.Playing },
  { name: 'server events', type: ActivityType.Watching },
  { name: 'staff actions', type: ActivityType.Listening }
];

function setPresence(client, activity) {
  client.user.setPresence({
    activities: [activity],
    status: 'online'
  });
}

function setContextPresence(client, text) {
  setPresence(client, {
    name: text,
    type: ActivityType.Watching
  });
}

function startPresenceRotation(client) {
  let index = 0;

  const applyCurrent = () => {
    const next = presenceList[index % presenceList.length];
    setPresence(client, next);
    index += 1;
  };

  applyCurrent();
  const timer = setInterval(applyCurrent, 5 * 60 * 1000);
  return timer;
}

module.exports = {
  setContextPresence,
  startPresenceRotation
};