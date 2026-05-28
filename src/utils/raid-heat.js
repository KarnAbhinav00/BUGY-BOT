const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');

function isLockdownActive(settings) {
  return Number(settings.protection?.lockdownUntil || 0) > Date.now();
}

function updateHeat(currentHeat, decayMinutes, lastHeatAt) {
  const now = Date.now();
  const decayWindow = Math.max(1, Number(decayMinutes || 5)) * 60_000;
  const decaySteps = Math.max(0, Math.floor((now - Number(lastHeatAt || now)) / decayWindow));
  return Math.max(0, Number(currentHeat || 0) - decaySteps);
}

function raiseRaidHeat(guildId, points, reason) {
  updateGuildSettings(guildId, (settings) => {
    const protection = settings.protection || {};
    const now = Date.now();
    const nextHeat = updateHeat(protection.heatLevel, protection.heatDecayMinutes, protection.lastHeatAt) + Number(points || 1);
    const threshold = Number(protection.heatThreshold || 10);
    const lockdownMinutes = Number(protection.lockdownMinutes || 10);
    const shouldLockdown = nextHeat >= threshold;

    return {
      ...settings,
      protection: {
        ...protection,
        heatLevel: nextHeat,
        lastHeatAt: now,
        lockdownUntil: shouldLockdown ? now + lockdownMinutes * 60_000 : protection.lockdownUntil || 0,
        lockdownReason: shouldLockdown ? reason : protection.lockdownReason || ''
      }
    };
  });
}

module.exports = {
  isLockdownActive,
  raiseRaidHeat
};