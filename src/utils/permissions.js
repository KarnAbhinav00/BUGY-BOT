const { PermissionsBitField } = require('discord.js');

function hasRoleId(member, roleIds) {
  return Array.isArray(roleIds) && roleIds.some((roleId) => member.roles.cache.has(roleId));
}

function isWhitelistedMember(member, settings) {
  if (!member || !settings) {
    return false;
  }

  const ownerIds = settings.whitelist?.ownerIds || [];
  const adminRoleIds = settings.whitelist?.adminRoleIds || [];
  const adminUserIds = settings.whitelist?.adminUserIds || [];
  const staffRoleIds = [...new Set([...(settings.whitelist?.staffRoleIds || []), '1490684254169075913'])];
  const staffUserIds = settings.whitelist?.staffUserIds || [];
  const helperRoleIds = settings.whitelist?.helperRoleIds || [];
  const helperUserIds = settings.whitelist?.helperUserIds || [];
  const chatModRoleIds = settings.whitelist?.chatModRoleIds || [];
  const chatModUserIds = settings.whitelist?.chatModUserIds || [];
  const vcModRoleIds = settings.whitelist?.vcModRoleIds || [];
  const vcModUserIds = settings.whitelist?.vcModUserIds || [];

  return ownerIds.includes(member.id)
    || adminUserIds.includes(member.id)
    || staffUserIds.includes(member.id)
    || helperUserIds.includes(member.id)
    || chatModUserIds.includes(member.id)
    || vcModUserIds.includes(member.id)
    || member.permissions.has('Administrator')
    || hasRoleId(member, adminRoleIds)
    || hasRoleId(member, staffRoleIds)
    || hasRoleId(member, helperRoleIds)
    || hasRoleId(member, chatModRoleIds)
    || hasRoleId(member, vcModRoleIds);
}

function hasCommandAccess(member, settings) {
  if (isWhitelistedMember(member, settings)) {
    return true;
  }

  return !settings?.whitelist?.ownerIds?.length && member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
}

function getEscalationRole(guild, settings, member) {
  const staffRoleIds = [...new Set([...(settings.whitelist?.staffRoleIds || []), '1490684254169075913'])];
  const staffRoles = staffRoleIds
    .map((roleId) => guild.roles.cache.get(roleId))
    .filter(Boolean)
    .sort((left, right) => left.position - right.position);

  const highestMemberRole = member.roles.highest;
  return staffRoles.find((role) => role.position > highestMemberRole.position) || staffRoles.at(-1) || null;
}

module.exports = {
  getEscalationRole,
  hasRoleId,
  isWhitelistedMember
};