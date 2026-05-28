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

  return ownerIds.includes(member.id)
    || adminUserIds.includes(member.id)
    || staffUserIds.includes(member.id)
    || member.permissions.has('Administrator')
    || hasRoleId(member, adminRoleIds)
    || hasRoleId(member, staffRoleIds);
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