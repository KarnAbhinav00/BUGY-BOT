const { EmbedBuilder } = require('discord.js');
const { updateGuildSettings } = require('../storage/guild-settings');
const { getStaffStat, updateStaffStat } = require('./staff-stats');

const tempBans = new Map();

function parseDuration(value) {
  const input = String(value || '').trim().toLowerCase();

  if (!input || ['perm', 'permanent', 'forever', '455d'].includes(input)) {
    return null;
  }

  const normalized = input.replace(/\s+/g, '');
  const durationPatterns = [
    { regex: /^(\d+)(?:\.(\d+))?(s|sec|secs|second|seconds)$/, multiplier: 1000 },
    { regex: /^(\d+)(?:\.(\d+))?(m|min|mins|minute|minutes)$/, multiplier: 60_000 },
    { regex: /^(\d+)(?:\.(\d+))?(h|hr|hrs|hour|hours)$/, multiplier: 3_600_000 },
    { regex: /^(\d+)(?:\.(\d+))?(d|day|days)$/, multiplier: 86_400_000 }
  ];

  for (const { regex, multiplier } of durationPatterns) {
    const match = normalized.match(regex);
    if (!match) continue;

    const amount = Number(`${match[1]}${match[2] ? `.${match[2]}` : ''}`);
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    return Math.round(amount * multiplier);
  }

  return null;
}

async function scheduleUnban(guild, userId, durationMs) {
  const timer = setTimeout(async () => {
    await guild.members.unban(userId, 'Temporary ban expired').catch(() => null);
    tempBans.delete(`${guild.id}:${userId}`);
  }, durationMs);

  timer.unref?.();
  tempBans.set(`${guild.id}:${userId}`, timer);
}

async function banMember(interaction, user, time, reason) {
  const durationMs = parseDuration(time);
  await interaction.guild.members.ban(user.id, { reason }).catch(() => null);

  if (durationMs) {
    await scheduleUnban(interaction.guild, user.id, durationMs);
  }

  return {
    durationLabel: durationMs ? time : 'permanent'
  };
}

async function kickMember(member, reason) {
  await member.kick(reason).catch(() => null);
}

async function timeoutMember(member, time, reason) {
  const durationMs = parseDuration(time) || 60_000;
  await member.timeout(durationMs, reason).catch(() => null);
  return durationMs;
}

async function purgeMessages(channel, amount) {
  const deleted = await channel.bulkDelete(amount, true).catch(() => null);
  return deleted?.size || 0;
}

async function warnMember(interaction, user, reason) {
  const settings = interaction.guild ? interaction.client.commands.get('config') ? null : null : null;
  const logChannelId = interaction.guild ? interaction.client.guilds.cache.get(interaction.guild.id)?.channels.cache.get(interaction.guild.channels.cache.get(interaction.guild.id)) : null;
  return { reason, user };
}

function recordStaffProfile(guildId, userId, patch) {
  updateGuildSettings(guildId, (settings) => ({
    ...settings,
    staffStats: {
      ...(settings.staffStats || {}),
      [userId]: {
        ...getStaffStat(settings, userId),
        ...patch
      }
    }
  }));
}

module.exports = {
  banMember,
  kickMember,
  parseDuration,
  purgeMessages,
  recordStaffProfile,
  timeoutMember
};