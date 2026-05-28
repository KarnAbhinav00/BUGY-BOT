const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Show detailed information about a role.')
    .addRoleOption((option) => option.setName('role').setDescription('Role to inspect').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles to use this command.', ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('role', true);
    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 ${role.name} Role Info`)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Members', value: `${role.members.size}`, inline: true },
        { name: 'Created', value: role.createdTimestamp ? `<t:${Math.floor(role.createdTimestamp / 1000)}:F>` : 'Unknown', inline: true },
        { name: 'Managed', value: role.managed ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await message.reply({ content: 'You need Manage Roles to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const role = message.mentions.roles.first();

    if (!role) {
      await message.reply({ content: 'Usage: !roleinfo @role', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 ${role.name} Role Info`)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Members', value: `${role.members.size}`, inline: true },
        { name: 'Created', value: role.createdTimestamp ? `<t:${Math.floor(role.createdTimestamp / 1000)}:F>` : 'Unknown', inline: true },
        { name: 'Managed', value: role.managed ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
