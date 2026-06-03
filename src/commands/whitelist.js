const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');

function updateList(currentList, action, value) {
  const next = new Set(currentList || []);

  if (action === 'add') {
    next.add(value);
  } else {
    next.delete(value);
  }

  return [...next];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage owner, admin, staff, helper, chat mod and voice mod access.')
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add a role or user to a hierarchy level.')
      .addStringOption((option) => option.setName('type').setDescription('Role or user').addChoices({ name: 'role', value: 'role' }, { name: 'user', value: 'user' }).setRequired(true))
      .addStringOption((option) => option.setName('level').setDescription('Hierarchy level').addChoices(
        { name: 'owner', value: 'owner' },
        { name: 'admin', value: 'admin' },
        { name: 'staff', value: 'staff' },
        { name: 'helper', value: 'helper' },
        { name: 'chat moderator', value: 'chatmod' },
        { name: 'voice moderator', value: 'vcmod' }
      ).setRequired(true))
      .addRoleOption((option) => option.setName('role').setDescription('Role to whitelist').setRequired(false))
      .addUserOption((option) => option.setName('user').setDescription('User to whitelist').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove a role or user from a hierarchy level.')
      .addStringOption((option) => option.setName('type').setDescription('Role or user').addChoices({ name: 'role', value: 'role' }, { name: 'user', value: 'user' }).setRequired(true))
      .addStringOption((option) => option.setName('level').setDescription('Hierarchy level').addChoices(
        { name: 'owner', value: 'owner' },
        { name: 'admin', value: 'admin' },
        { name: 'staff', value: 'staff' },
        { name: 'helper', value: 'helper' },
        { name: 'chat moderator', value: 'chatmod' },
        { name: 'voice moderator', value: 'vcmod' }
      ).setRequired(true))
      .addRoleOption((option) => option.setName('role').setDescription('Role to remove').setRequired(false))
      .addUserOption((option) => option.setName('user').setDescription('User to remove').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('Show current whitelist levels.')),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const settings = getGuildSettings(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Command Hierarchy')
        .setDescription([
          `Owners: ${(settings.whitelist.ownerIds || []).map((id) => `<@${id}>`).join(', ') || 'None'}`,
          `Admins: ${(settings.whitelist.adminRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          `Staff: ${(settings.whitelist.staffRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`
        ].join('\n'));

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const type = interaction.options.getString('type', true);
    const level = interaction.options.getString('level', true);
    const role = interaction.options.getRole('role');
    const user = interaction.options.getUser('user');

    if (type === 'role' && !role) {
      await interaction.reply({ content: 'You must supply a role.', ephemeral: true });
      return;
    }

    if (type === 'user' && !user) {
      await interaction.reply({ content: 'You must supply a user.', ephemeral: true });
      return;
    }

    updateGuildSettings(interaction.guild.id, (settings) => {
      const whitelist = {
        ...(settings.whitelist || { ownerIds: [], adminRoleIds: [], adminUserIds: [], staffRoleIds: [], staffUserIds: [], helperRoleIds: [], helperUserIds: [], chatModRoleIds: [], chatModUserIds: [], vcModRoleIds: [], vcModUserIds: [] })
      };

      const key = level === 'owner'
        ? 'ownerIds'
        : level === 'admin'
          ? type === 'role' ? 'adminRoleIds' : 'adminUserIds'
          : level === 'staff'
            ? type === 'role' ? 'staffRoleIds' : 'staffUserIds'
            : level === 'helper'
              ? type === 'role' ? 'helperRoleIds' : 'helperUserIds'
              : level === 'chatmod'
                ? type === 'role' ? 'chatModRoleIds' : 'chatModUserIds'
                : type === 'role' ? 'vcModRoleIds' : 'vcModUserIds';
      const targetValue = type === 'role' ? role.id : user.id;
      whitelist[key] = updateList(whitelist[key], subcommand, targetValue);

      return {
        ...settings,
        whitelist
      };
    });

    await interaction.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} ${type} for ${level}.`, ephemeral: true });
  },
  async handleMessage(message, args = []) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ content: 'You need Manage Server to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const [subcommand, type, level] = args.slice(1);

    if (subcommand === 'list') {
      const settings = getGuildSettings(message.guild.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Command Hierarchy')
        .setDescription([
          `Owners: ${(settings.whitelist.ownerIds || []).map((id) => `<@${id}>`).join(', ') || 'None'}`,
          `Admins: ${(settings.whitelist.adminRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          `Staff: ${(settings.whitelist.staffRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          `Helpers: ${(settings.whitelist.helperRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          `Chat Mods: ${(settings.whitelist.chatModRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          `VC Mods: ${(settings.whitelist.vcModRoleIds || []).map((id) => `<@&${id}>`).join(', ') || 'None'}`
        ].join('\n'));

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const role = message.mentions.roles.first();
    const user = message.mentions.users.first();
    const targetValue = type === 'role' ? role?.id : user?.id;

    if (!targetValue || !['owner', 'admin', 'staff', 'helper', 'chatmod', 'vcmod'].includes(level)) {
      await message.reply({ content: 'Usage: !whitelist add role staff @role | !whitelist add user helper @user | !whitelist list', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    updateGuildSettings(message.guild.id, (settings) => {
      const whitelist = {
        ...(settings.whitelist || { ownerIds: [], adminRoleIds: [], adminUserIds: [], staffRoleIds: [], staffUserIds: [], helperRoleIds: [], helperUserIds: [], chatModRoleIds: [], chatModUserIds: [], vcModRoleIds: [], vcModUserIds: [] })
      };

      const key = level === 'owner'
        ? 'ownerIds'
        : level === 'admin'
          ? type === 'role' ? 'adminRoleIds' : 'adminUserIds'
          : level === 'staff'
            ? type === 'role' ? 'staffRoleIds' : 'staffUserIds'
            : level === 'helper'
              ? type === 'role' ? 'helperRoleIds' : 'helperUserIds'
              : level === 'chatmod'
                ? type === 'role' ? 'chatModRoleIds' : 'chatModUserIds'
                : type === 'role' ? 'vcModRoleIds' : 'vcModUserIds';
      whitelist[key] = updateList(whitelist[key], subcommand, targetValue);

      return {
        ...settings,
        whitelist
      };
    });

    await message.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} ${type} for ${level}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};