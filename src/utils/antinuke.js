const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const { getGuildSettings } = require('../storage/guild-settings');

const windowMs = 15_000;
const state = new Map();

const auditTypeMap = {
  channelCreate: AuditLogEvent.ChannelCreate,
  channelDelete: AuditLogEvent.ChannelDelete,
  roleCreate: AuditLogEvent.RoleCreate,
  roleDelete: AuditLogEvent.RoleDelete,
  banAdd: AuditLogEvent.MemberBanAdd
};

async function punish(member, settings, reason) {
  if (!member?.manageable && !member?.bannable) {
    return;
  }

  if (settings.punishment === 'ban' && member.bannable) {
    await member.ban({ reason }).catch(() => null);
    return;
  }

  const timeoutMs = Math.max(1, Number(settings.timeoutMinutes || 60)) * 60_000;
  if (member.moderatable) {
    await member.timeout(timeoutMs, reason).catch(() => null);
  }
}

async function logAntiNuke(guild, settings, content) {
  if (!settings.logChannelId) {
    return;
  }

  const logChannel = guild.channels.cache.get(settings.logChannelId);
  if (logChannel?.isTextBased()) {
    await logChannel.send({ content }).catch(() => null);
  }
}
const { updateGuildSettings } = require('../storage/guild-settings');
const { raiseRaidHeat } = require('./raid-heat');

async function handleGuard(guild, action, fetchAuditEntry) {
  const settings = getGuildSettings(guild.id).antiNuke;

  if (!settings.enabled) {
    return;
  }

  const entry = await fetchAuditEntry().catch(() => null);
  const auditEntry = entry?.entries?.first?.();

  if (!auditEntry?.executorId || auditEntry.executorId === guild.ownerId) {
    return;
  }

  const member = await guild.members.fetch(auditEntry.executorId).catch(() => null);
  if (!member || member.user.bot) {
    return;
  }

  const key = `${guild.id}:${member.id}`;
  const now = Date.now();
  const recent = (state.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  state.set(key, recent);

  if (recent.length < Number(settings.threshold || 3)) {
    return;
  }

  await punish(member, settings, `Anti-nuke triggered for ${action}`).catch(() => null);
  await logAntiNuke(guild, settings, `Anti-nuke triggered for ${member.user.tag} after ${recent.length} ${action} actions.`);
  raiseRaidHeat(guild.id, 2, `Suspicious ${action}`);
  updateGuildSettings(guild.id, (current) => ({
    ...current,
    protection: {
      ...(current.protection || {}),
      heatLevel: Number(current.protection?.heatLevel || 0) + 5,
      lastHeatAt: Date.now(),
      lockdownUntil: Date.now() + Number(current.protection?.lockdownMinutes || 10) * 60_000,
      lockdownReason: `Anti-nuke triggered for ${action}`
    }
  }));
  state.delete(key);
}

async function guardChannelCreate(channel) {
  await handleGuard(channel.guild, 'channel create', () => channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 }));
}

async function guardChannelDelete(channel) {
  await handleGuard(channel.guild, 'channel delete', () => channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 }));
}

async function guardRoleCreate(role) {
  await handleGuard(role.guild, 'role create', () => role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 }));
}

async function guardRoleDelete(role) {
  await handleGuard(role.guild, 'role delete', () => role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 }));
}

async function guardBanAdd(ban) {
  await handleGuard(ban.guild, 'ban add', () => ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }));
}

module.exports = {
  guardBanAdd,
  guardChannelCreate,
  guardChannelDelete,
  guardRoleCreate,
  guardRoleDelete
};