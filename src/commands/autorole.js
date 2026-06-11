const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage autoroles.')
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add an autorole.')
      .addRoleOption((option) => option.setName('role').setDescription('Role to add automatically').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove an autorole.')
      .addRoleOption((option) => option.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('List autoroles.')),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole('role');

    if (subcommand === 'list') {
      const settings = getGuildSettings(interaction.guild.id);
      const roles = settings.autoroleIds.map((roleId) => `<@&${roleId}>`).join('\n') || 'No autoroles configured.';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Autoroles').setDescription(roles)], ephemeral: true });
      return;
    }

    updateGuildSettings(interaction.guild.id, (settings) => {
      const autoroleIds = new Set(settings.autoroleIds || []);

      if (subcommand === 'add') {
        autoroleIds.add(role.id);
      } else {
        autoroleIds.delete(role.id);
      }

      return {
        ...settings,
        autoroleIds: [...autoroleIds]
      };
    });

    await interaction.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} autorole ${role}.`, ephemeral: true });
  },
  async handleMessage(message, args = []) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const [subcommand] = args.slice(1);
    const role = message.mentions.roles.first();

    if (subcommand === 'list') {
      const settings = getGuildSettings(message.guild.id);
      const roles = settings.autoroleIds.map((roleId) => `<@&${roleId}>`).join('\n') || 'No autoroles configured.';
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Autoroles').setDescription(roles)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (!role) {
      await message.reply({ content: 'Usage: !autorole add @role | !autorole remove @role | !autorole list', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    updateGuildSettings(message.guild.id, (settings) => {
      const autoroleIds = new Set(settings.autoroleIds || []);

      if (subcommand === 'add') {
        autoroleIds.add(role.id);
      } else {
        autoroleIds.delete(role.id);
      }

      return {
        ...settings,
        autoroleIds: [...autoroleIds]
      };
    });

    await message.reply({ content: `${subcommand === 'add' ? 'Added' : 'Removed'} autorole ${role}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};