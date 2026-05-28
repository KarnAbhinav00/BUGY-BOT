const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

function describeChannelType(channel) {
  if (channel.type === ChannelType.GuildText) return 'Text';
  if (channel.type === ChannelType.GuildVoice) return 'Voice';
  if (channel.type === ChannelType.GuildAnnouncement) return 'Announcement';
  if (channel.type === ChannelType.GuildCategory) return 'Category';
  return 'Other';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Show detailed information about a channel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Channel to inspect').setRequired(false)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) && !channel.isDMBased()) {
      await interaction.reply({ content: 'You need Manage Channels to use this command.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📡 ${channel.name || 'Channel'} Info`)
      .addFields(
        { name: 'Type', value: describeChannelType(channel), inline: true },
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Created', value: channel.createdTimestamp ? `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>` : 'Unknown', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  async handleMessage(message) {
    const channel = message.mentions.channels.first() || message.channel;

    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && !channel.isDMBased()) {
      await message.reply({ content: 'You need Manage Channels to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📡 ${channel.name || 'Channel'} Info`)
      .addFields(
        { name: 'Type', value: describeChannelType(channel), inline: true },
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Created', value: channel.createdTimestamp ? `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>` : 'Unknown', inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
