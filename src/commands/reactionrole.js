const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { isWhitelistedMember } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles.')
    .addSubcommand((subcommand) => subcommand
      .setName('create')
      .setDescription('Create a reaction-role panel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Panel channel').setRequired(true))
      .addStringOption((option) => option.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption((option) => option.setName('description').setDescription('Panel description').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Map an emoji to a role for a panel message.')
      .addChannelOption((option) => option.setName('channel').setDescription('Channel containing the panel message').setRequired(true))
      .addStringOption((option) => option.setName('message_id').setDescription('Panel message ID').setRequired(true))
      .addStringOption((option) => option.setName('emoji').setDescription('Emoji to use').setRequired(true))
      .addRoleOption((option) => option.setName('role').setDescription('Role to grant').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove a reaction-role mapping.')
      .addChannelOption((option) => option.setName('channel').setDescription('Channel containing the panel message').setRequired(true))
      .addStringOption((option) => option.setName('message_id').setDescription('Panel message ID').setRequired(true))
      .addStringOption((option) => option.setName('emoji').setDescription('Emoji to remove').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('List reaction roles.')),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!isWhitelistedMember(interaction.member, settings)) {
      await interaction.reply({ content: 'You need permission to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const channel = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);

      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(description);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`reactionrole-info-${Date.now()}`).setLabel('React to get roles').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      const panelMessage = await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `Reaction-role panel created: ${panelMessage.id}`, ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      const settings = getGuildSettings(interaction.guild.id);
      const lines = (settings.reactionRoles || []).map((entry) => `${entry.emoji} -> <@&${entry.roleId}> (message ${entry.messageId})`).join('\n') || 'No reaction roles configured.';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Reaction Roles').setDescription(lines)], ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const messageId = interaction.options.getString('message_id', true);
    const emoji = interaction.options.getString('emoji', true);

    if (subcommand === 'add') {
      const role = interaction.options.getRole('role', true);
      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        reactionRoles: [
          ...(settings.reactionRoles || []).filter((entry) => !(entry.messageId === messageId && entry.emoji === emoji)),
          { messageId, emoji, roleId: role.id }
        ]
      }));

      const targetMessage = await channel.messages.fetch(messageId).catch(() => null);
      if (targetMessage) {
        await targetMessage.react(emoji).catch(() => null);
      }

      await interaction.reply({ content: `Mapped ${emoji} to ${role} for message ${messageId}.`, ephemeral: true });
      return;
    }

    updateGuildSettings(interaction.guild.id, (settings) => ({
      ...settings,
      reactionRoles: (settings.reactionRoles || []).filter((entry) => !(entry.messageId === messageId && entry.emoji === emoji))
    }));

    await interaction.reply({ content: `Removed reaction role mapping for ${emoji} on message ${messageId}.`, ephemeral: true });
  },
  async handleMessage(message, args = []) {
    const settings = getGuildSettings(message.guild.id);
    if (!isWhitelistedMember(message.member, settings)) {
      await message.reply({ content: 'You need permission to use this command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const [subcommand] = args.slice(1);

    if (subcommand === 'create') {
      const channel = message.mentions.channels.first();
      const roleParts = message.content.split('|').map((part) => part.trim());
      const title = roleParts[0]?.split(/\s+/).slice(2).join(' ');
      const description = roleParts[1] || '';

      if (!channel || !title || !description) {
        await message.reply({ content: 'Usage: !reactionrole create #channel Title | Description', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(description);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`reactionrole-info-${Date.now()}`).setLabel('React to get roles').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      const panelMessage = await channel.send({ embeds: [embed], components: [row] });
      await message.reply({ content: `Reaction-role panel created: ${panelMessage.id}`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'list') {
      const settings = getGuildSettings(message.guild.id);
      const lines = (settings.reactionRoles || []).map((entry) => `${entry.emoji} -> <@&${entry.roleId}> (message ${entry.messageId})`).join('\n') || 'No reaction roles configured.';
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Reaction Roles').setDescription(lines)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const channel = message.mentions.channels.first();
    const messageId = args[2];
    const emoji = args[3];

    if (!channel || !messageId || !emoji) {
      await message.reply({ content: 'Usage: !reactionrole add #channel messageId emoji @role', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'add') {
      const role = message.mentions.roles.first();
      if (!role) {
        await message.reply({ content: 'You must mention a role.', allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      updateGuildSettings(message.guild.id, (settings) => ({
        ...settings,
        reactionRoles: [
          ...(settings.reactionRoles || []).filter((entry) => !(entry.messageId === messageId && entry.emoji === emoji)),
          { messageId, emoji, roleId: role.id }
        ]
      }));

      const targetMessage = await channel.messages.fetch(messageId).catch(() => null);
      if (targetMessage) {
        await targetMessage.react(emoji).catch(() => null);
      }

      await message.reply({ content: `Mapped ${emoji} to ${role} for message ${messageId}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    updateGuildSettings(message.guild.id, (settings) => ({
      ...settings,
      reactionRoles: (settings.reactionRoles || []).filter((entry) => !(entry.messageId === messageId && entry.emoji === emoji))
    }));

    await message.reply({ content: `Removed reaction role mapping for ${emoji} on message ${messageId}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};