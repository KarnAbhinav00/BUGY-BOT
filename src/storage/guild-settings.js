const fs = require('node:fs');
const config = require('../config');
const { blockedLinkPresets, englishPresets, hinglishPresets } = require('../utils/moderation-presets');

const defaultGuildSettings = {
  prefix: config.defaultPrefix,
  prefixes: [config.defaultPrefix],
  welcomeChannelId: '',
  welcomeMessage: `Welcome To Bug Empire
Read ⁠ properly.
Follow Discord Tos [https://discord.com/terms](https://discord.com/terms)
Check out ⁠![:izakaya_lantern:](https://discord.com/assets/2287aa6a938cefb4.svg)・giveaways
Meet new people ⁠![:pancakes:](https://discord.com/assets/81b90a35157071a6.svg)・chill-chat
Support required? head over to ⁠![:mailbox_with_mail:](https://discord.com/assets/fedef3c18beeb970.svg)・ticket`,
  leaveChannelId: '',
  leaveMessage: '{user} left {server}.',
  moderationLogChannelId: '',
  blockedWords: [...new Set([...config.blockedWords, ...englishPresets, ...hinglishPresets])],
  blockedLinks: [...blockedLinkPresets],
  protection: {
    enabled: true,
    deleteBadWords: true,
    deleteLinks: true,
    timeoutForWords: true,
    timeoutForLinks: true,
    banOnRepeat: false,
    timeoutMinutes: 60,
    logChannelId: '',
    heatLevel: 0,
    heatThreshold: 10,
    heatDecayMinutes: 5,
    lockdownMinutes: 10,
    lockdownUntil: 0,
    lockdownReason: ''
  },
  autoroleIds: [],
  reactionRoles: [],
  whitelist: {
    ownerIds: [],
    adminRoleIds: [],
    adminUserIds: [],
    staffRoleIds: [],
    staffUserIds: [],
    helperRoleIds: [],
    helperUserIds: [],
    chatModRoleIds: [],
    chatModUserIds: [],
    vcModRoleIds: [],
    vcModUserIds: []
  },
  greeting: {
    enabled: true,
    channelId: '',
    message: `Welcome To Bug Empire
Read ⁠ properly.
Follow Discord Tos [https://discord.com/terms](https://discord.com/terms)
Check out ⁠![:izakaya_lantern:](https://discord.com/assets/2287aa6a938cefb4.svg)・giveaways
Meet new people ⁠![:pancakes:](https://discord.com/assets/81b90a35157071a6.svg)・chill-chat
Support required? head over to ⁠![:mailbox_with_mail:](https://discord.com/assets/fedef3c18beeb970.svg)・ticket`,
    panelChannelId: '',
    panelMessageId: ''
  },
  staffStats: {},
  notes: {},
  ticket: {
    categoryId: '',
    supportRoleId: '',
    logChannelId: '',
    panelChannelId: '',
    panelMessageId: '',
    panelTitle: 'Open a support ticket',
    panelDescription: 'Choose a reason from the dropdown below to open a private ticket with the support team.',
    panelEmoji: '🎫',
    staffApplicationsEnabled: false,
    counter: 0,
    panels: [],
    tickets: {},
    inactivityMinutes: 1440,
    inactivityReminderMinutes: 10
  },
  antiNuke: {
    enabled: config.antiNuke.enabled,
    threshold: config.antiNuke.threshold,
    punishment: config.antiNuke.punishment,
    timeoutMinutes: config.antiNuke.timeoutMinutes,
    logChannelId: ''
  }
};

function ensureDataFile() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  if (!fs.existsSync(config.settingsFile)) {
    fs.writeFileSync(config.settingsFile, JSON.stringify({}, null, 2));
  }
}

function loadAllSettings() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(config.settingsFile, 'utf8'));
}

function saveAllSettings(settings) {
  ensureDataFile();
  fs.writeFileSync(config.settingsFile, JSON.stringify(settings, null, 2));
}

function mergeSettings(base, patch) {
  const result = Array.isArray(base) ? [...base] : { ...base };

  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      result[key] = mergeSettings(base[key], value);
      continue;
    }

    result[key] = Array.isArray(value) ? [...value] : value;
  }

  return result;
}

function getGuildSettings(guildId) {
  const allSettings = loadAllSettings();
  const guildSettings = allSettings[guildId] || {};
  return mergeSettings(defaultGuildSettings, guildSettings);
}

function getAllGuildSettings() {
  return loadAllSettings();
}

function updateGuildSettings(guildId, updater) {
  const allSettings = loadAllSettings();
  const currentSettings = getGuildSettings(guildId);
  const nextSettings = typeof updater === 'function' ? updater(currentSettings) : updater;

  allSettings[guildId] = mergeSettings(defaultGuildSettings, nextSettings || currentSettings);
  saveAllSettings(allSettings);
  return allSettings[guildId];
}

module.exports = {
  getAllGuildSettings,
  defaultGuildSettings,
  getGuildSettings,
  updateGuildSettings
};