const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');

module.exports = {
  name: 'messageReactionAdd',
  async execute(client, reaction, user) {
    if (user.bot) {
      return;
    }

    if (reaction.partial || reaction.message.partial) {
      await reaction.fetch().catch(() => null);
    }

    const guild = reaction.message.guild;
    if (!guild) {
      return;
    }

    const settings = getGuildSettings(guild.id);
    const match = (settings.reactionRoles || []).find((entry) => entry.messageId === reaction.message.id && entry.emoji === reaction.emoji.toString());

    if (!match) {
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return;
    }

    await member.roles.add(match.roleId).catch(() => null);
  }
};