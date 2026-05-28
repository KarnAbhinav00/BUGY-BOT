const path = require('node:path');

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  transcriptsDir: path.join(rootDir, 'data', 'transcripts'),
  settingsFile: path.join(rootDir, 'data', 'guild-settings.json'),
  defaultFooter: 'Made with 🧠',
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID || '1274360936748290108',
  defaultPrefix: process.env.DEFAULT_PREFIX || '?',
  blockedWords: parseList(process.env.BLOCKED_WORDS),
  antiNuke: {
    enabled: parseBoolean(process.env.ANTI_NUKE_ENABLED, false),
    threshold: parseNumber(process.env.ANTI_NUKE_THRESHOLD, 3),
    punishment: (process.env.ANTI_NUKE_PUNISHMENT || 'timeout').toLowerCase(),
    timeoutMinutes: parseNumber(process.env.ANTI_NUKE_TIMEOUT_MINUTES, 60)
  }
};