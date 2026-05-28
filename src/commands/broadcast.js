const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Send an announcement to a channel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addStringOption((option) => option.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption((option) => option.setName('message').setDescription('Announcement message').setRequired(true))
    .addStringOption((option) => option.setName('color').setDescription('Hex color like 5865f2').setRequired(false)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await interaction.reply({ content: 'You need Manage Messages to broadcast.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const message = interaction.options.getString('message', true);
    const color = interaction.options.getString('color') || '5865f2';

    const embed = new EmbedBuilder()
      .setColor(Number.parseInt(color.replace('#', ''), 16) || 0x5865f2)
      .setTitle(title)
      .setDescription(message)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `Broadcast sent to ${channel}.`, ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await message.reply({ content: 'You need Manage Messages to broadcast.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const channel = message.mentions.channels.first();
    const payload = message.content.split('|').map((part) => part.trim());
    const title = payload[0]?.split(/\s+/).slice(1).join(' ');
    const body = payload[1] || '';
    const color = payload[2] || '5865f2';

    if (!channel || !title || !body) {
      await message.reply({ content: 'Usage: !broadcast #channel Title | Message | #5865f2', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Number.parseInt(color.replace('#', ''), 16) || 0x5865f2)
      .setTitle(title)
      .setDescription(body)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    await message.reply({ content: `Broadcast sent to ${channel}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};