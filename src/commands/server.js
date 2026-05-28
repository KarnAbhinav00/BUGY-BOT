const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

function formatChannelName(channel) {
  return channel?.name ? `#${channel.name}` : 'this channel';
}

function resolveTextChannel(interaction, optionName = 'channel') {
  return interaction.options.getChannel(optionName) || interaction.channel;
}

function buildServerInfoEmbed(guild) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 ${guild.name} Overview`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Members', value: `${guild.memberCount}`, inline: true },
      { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
      { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true }
    )
    .setFooter({ text: `Server ID: ${guild.id}` })
    .setTimestamp();
}

async function toggleChannelLock(channel, locked) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: locked ? false : null,
    AddReactions: locked ? false : null,
    CreatePublicThreads: locked ? false : null,
    CreatePrivateThreads: locked ? false : null
  }).catch(() => null);
}

async function applyServerAction(messageOrInteraction, args = [], isSlashInteraction = false) {
  const target = isSlashInteraction ? messageOrInteraction : messageOrInteraction;
  const subcommand = (args[0] || 'info').toLowerCase();

  if (subcommand === 'info') {
    const guild = isSlashInteraction ? target.guild : target.guild;
    const payload = { embeds: [buildServerInfoEmbed(guild)] };

    if (isSlashInteraction) {
      await target.reply({ ...payload, ephemeral: true });
    } else {
      await target.reply({ ...payload, allowedMentions: { repliedUser: false } }).catch(() => null);
    }

    return;
  }

  const hasManageChannels = isSlashInteraction
    ? target.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)
    : target.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

  if (!hasManageChannels) {
    const content = 'You need Manage Channels to use that command.';
    if (isSlashInteraction) {
      await target.reply({ content, ephemeral: true });
    } else {
      await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
    }
    return;
  }

  const channel = isSlashInteraction
    ? resolveTextChannel(target)
    : target.mentions.channels.first() || target.channel;

  if (!channel?.isTextBased?.()) {
    const content = 'Pick a text channel for that action.';
    if (isSlashInteraction) {
      await target.reply({ content, ephemeral: true });
    } else {
      await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
    }
    return;
  }

  if (subcommand === 'lock' || subcommand === 'unlock') {
    await toggleChannelLock(channel, subcommand === 'lock');
    const content = `${subcommand === 'lock' ? '🔒 Locked' : '🔓 Unlocked'} ${formatChannelName(channel)}.`;

    if (isSlashInteraction) {
      await target.reply({ content, ephemeral: true });
    } else {
      await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
    }

    return;
  }

  if (subcommand === 'slowmode') {
    const seconds = isSlashInteraction ? target.options.getInteger('seconds', true) : Number(args[1]);

    if (!Number.isFinite(seconds) || seconds < 0) {
      const content = 'Usage: !slowmode <seconds> [#channel]';
      if (isSlashInteraction) {
        await target.reply({ content, ephemeral: true });
      } else {
        await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
      }
      return;
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode updated by ${isSlashInteraction ? target.user.tag : target.author.tag}`).catch(() => null);
    const content = `⏳ Set slowmode to ${seconds} seconds in ${formatChannelName(channel)}.`;

    if (isSlashInteraction) {
      await target.reply({ content, ephemeral: true });
    } else {
      await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
    }

    return;
  }

  if (subcommand === 'topic') {
    const topicText = isSlashInteraction ? target.options.getString('text', true) : args.slice(1).join(' ').trim();

    if (!topicText) {
      const content = 'Usage: !topic <text> [#channel]';
      if (isSlashInteraction) {
        await target.reply({ content, ephemeral: true });
      } else {
        await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
      }
      return;
    }

    await channel.setTopic(topicText).catch(() => null);
    const content = `📌 Updated the topic for ${formatChannelName(channel)}.`;

    if (isSlashInteraction) {
      await target.reply({ content, ephemeral: true });
    } else {
      await target.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Server organization tools.')
    .addSubcommand((subcommand) => subcommand
      .setName('info')
      .setDescription('Show server information.'))
    .addSubcommand((subcommand) => subcommand
      .setName('lock')
      .setDescription('Lock a text channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Channel to lock').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
      .addStringOption((option) => option.setName('reason').setDescription('Lock reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('unlock')
      .setDescription('Unlock a text channel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Channel to unlock').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
      .addStringOption((option) => option.setName('reason').setDescription('Unlock reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('slowmode')
      .setDescription('Set slowmode for a text channel.')
      .addIntegerOption((option) => option.setName('seconds').setDescription('Slowmode seconds').setMinValue(0).setMaxValue(21_600).setRequired(true))
      .addChannelOption((option) => option.setName('channel').setDescription('Channel to edit').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
      .addStringOption((option) => option.setName('reason').setDescription('Slowmode reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('topic')
      .setDescription('Set the current channel topic.')
      .addStringOption((option) => option.setName('text').setDescription('New topic text').setRequired(true))
      .addChannelOption((option) => option.setName('channel').setDescription('Channel to edit').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await applyServerAction(interaction, [subcommand], true);
  },
  async handleMessage(message, rawArgs = []) {
    await applyServerAction(message, rawArgs, false);
  }
};