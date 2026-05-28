require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');

if (!config.token || !config.clientId) {
  throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.commands = new Collection();

function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsDir)) {
    return;
  }

  for (const file of fs.readdirSync(commandsDir).filter((entry) => entry.endsWith('.js'))) {
    const command = require(path.join(commandsDir, file));

    if (command?.data?.name && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  }
}

function loadEvents() {
  const eventsDir = path.join(__dirname, 'events');

  if (!fs.existsSync(eventsDir)) {
    return;
  }

  for (const file of fs.readdirSync(eventsDir).filter((entry) => entry.endsWith('.js'))) {
    const event = require(path.join(eventsDir, file));

    if (!event?.name || typeof event.execute !== 'function') {
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
      continue;
    }

    client.on(event.name, (...args) => event.execute(client, ...args));
  }
}

loadCommands();
loadEvents();

client.login(config.token);