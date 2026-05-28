const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

const CHECK_PERMISSIONS = [
  { key: PermissionsBitField.Flags.ViewChannel, label: 'View Channel' },
  { key: PermissionsBitField.Flags.SendMessages, label: 'Send Messages' },
  { key: PermissionsBitField.Flags.SendMessagesInThreads, label: 'Send Messages in Threads' },
  { key: PermissionsBitField.Flags.ReadMessageHistory, label: 'Read Message History' },
  { key: PermissionsBitField.Flags.EmbedLinks, label: 'Embed Links' },
  { key: PermissionsBitField.Flags.AttachFiles, label: 'Attach Files' },
  { key: PermissionsBitField.Flags.AddReactions, label: 'Add Reactions' },
  { key: PermissionsBitField.Flags.ManageMessages, label: 'Manage Messages' },
  { key: PermissionsBitField.Flags.ManageChannels, label: 'Manage Channels' },
  { key: PermissionsBitField.Flags.ModerateMembers, label: 'Timeout Members' },
  { key: PermissionsBitField.Flags.KickMembers, label: 'Kick Members' },
  { key: PermissionsBitField.Flags.BanMembers, label: 'Ban Members' },
  { key: PermissionsBitField.Flags.ManageRoles, label: 'Manage Roles' },
  { key: PermissionsBitField.Flags.CreatePublicThreads, label: 'Create Public Threads' },
  { key: PermissionsBitField.Flags.CreatePrivateThreads, label: 'Create Private Threads' },
  { key: PermissionsBitField.Flags.UseExternalEmojis, label: 'Use External Emojis' }
];

function resolveTargetChannel(interactionOrMessage, channelOptionName = 'channel') {
  if (interactionOrMessage.options?.getChannel) {
    return interactionOrMessage.options.getChannel(channelOptionName) || interactionOrMessage.channel;
  }

  return interactionOrMessage.mentions?.channels?.first() || interactionOrMessage.channel;
}

function buildPermissionEmbed(subject, channel, botMember) {
  const allowed = [];
  const missing = [];
  const channelPermissions = channel.permissionsFor(botMember);

  for (const permission of CHECK_PERMISSIONS) {
    if (channelPermissions?.has(permission.key)) {
      allowed.push(`✅ ${permission.label}`);
    } else {
      missing.push(`❌ ${permission.label}`);
    }
  }

  return new EmbedBuilder()
    .setColor(missing.length ? 0xe67e22 : 0x2ecc71)
    .setTitle('🤖 Bot Permission Check')
    .setDescription([
      `Channel: ${channel}`,
      `Status: ${missing.length ? 'Some permissions are missing' : 'All checked permissions are available'}`,
      `Checked for: ${subject.guild.name}`
    ].join('\n'))
    .addFields(
      { name: 'Allowed', value: allowed.join('\n') || 'None', inline: true },
      { name: 'Missing', value: missing.join('\n') || 'None', inline: true }
    )
    .setFooter({ text: `Bot: ${botMember.user.tag}` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Check what permissions the bot has in a channel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Channel to inspect').setRequired(false)),
  async execute(interaction) {
    const channel = resolveTargetChannel(interaction);
    const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);

    if (!botMember) {
      await interaction.reply({ content: 'I could not resolve my bot member record.', ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [buildPermissionEmbed(interaction, channel, botMember)], ephemeral: true });
  },
  async handleMessage(message) {
    const channel = resolveTargetChannel(message);
    const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);

    if (!botMember) {
      await message.reply({ content: 'I could not resolve my bot member record.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    await message.reply({ embeds: [buildPermissionEmbed(message, channel, botMember)], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};
