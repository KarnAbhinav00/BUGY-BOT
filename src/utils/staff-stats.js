const voiceSessions = new Map();
const { updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('./permissions');

function getStaffStat(settings, userId) {
  return settings.staffStats?.[userId] || {
    messages: 0,
    voiceMinutes: 0,
    ticketsHandled: 0,
    claims: 0,
    escalations: 0
  };
}

function updateStaffStat(guildId, userId, updater) {
  updateGuildSettings(guildId, (settings) => {
    const current = getStaffStat(settings, userId);
    const next = typeof updater === 'function' ? updater(current, settings) : updater;

    return {
      ...settings,
      staffStats: {
        ...(settings.staffStats || {}),
        [userId]: next
      }
    };
  });
}

function recordStaffMessage(member, settings) {
  if (!isWhitelistedMember(member, settings)) {
    return;
  }

  updateStaffStat(member.guild.id, member.id, (current) => ({
    ...current,
    messages: current.messages + 1
  }));
}

function startVoiceSession(member, settings) {
  if (!isWhitelistedMember(member, settings)) {
    return;
  }

  voiceSessions.set(`${member.guild.id}:${member.id}`, Date.now());
}

function endVoiceSession(member, settings) {
  const key = `${member.guild.id}:${member.id}`;
  const startedAt = voiceSessions.get(key);

  if (!startedAt || !isWhitelistedMember(member, settings)) {
    voiceSessions.delete(key);
    return;
  }

  const minutes = Math.max(0, Math.round((Date.now() - startedAt) / 60000));
  voiceSessions.delete(key);

  if (!minutes) {
    return;
  }

  updateStaffStat(member.guild.id, member.id, (current) => ({
    ...current,
    voiceMinutes: current.voiceMinutes + minutes
  }));
}

module.exports = {
  endVoiceSession,
  getStaffStat,
  recordStaffMessage,
  updateStaffStat,
  startVoiceSession
};