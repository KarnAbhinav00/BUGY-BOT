const { getGuildSettings } = require('../storage/guild-settings');
const { startVoiceSession, endVoiceSession } = require('../utils/staff-stats');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;

    if (!guild || !member) {
      return;
    }

    const settings = getGuildSettings(guild.id);
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (!oldChannelId && newChannelId) {
      startVoiceSession(member, settings);
      return;
    }

    if (oldChannelId && !newChannelId) {
      endVoiceSession(member, settings);
      return;
    }

    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      endVoiceSession(member, settings);
      startVoiceSession(member, settings);
    }
  }
};
