const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { AttachmentBuilder } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { buildTranscript } = require('../utils/transcript');
const { clearTicketRecord, getTicketRecord, isTicketChannel, upsertTicketRecord } = require('../utils/ticket-history');
const { updateStaffStat } = require('../utils/staff-stats');

const ticketReasons = [
  { label: '💬 General Support', value: 'general_support', description: 'Questions, help, or guidance.' },
  { label: '📝 Staff Apply (currently closed)', value: 'staff_apply', description: 'Applications are temporarily closed.' },
  { label: '🚨 Report Staff/Member', value: 'report_member', description: 'Report a staff member or regular user.' },
  { label: '🎁 Giveaway Claim', value: 'giveaway_claim', description: 'Claim a giveaway or prize.' },
  { label: '🎉 Event Query', value: 'event_query', description: 'Questions about an event.' },
  { label: '🤝 Sponsorships', value: 'sponsorships', description: 'Sponsorship-related contact.' },
  { label: '🔗 Partnerships', value: 'partnerships', description: 'Server or brand partnership request.' },
  { label: '📩 Outreaching for any services', value: 'outreach_services', description: 'Services or business outreach.' }
];

const ESCALATION_TICKET_ACCESS_ROLE_ID = '1500377466298962121';

function getReasonLabel(value) {
  return ticketReasons.find((reason) => reason.value === value)?.label || 'General Support';
}

function findTicketReason(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ticketReasons.find((reason) => reason.value === normalized || reason.label.toLowerCase().includes(normalized) || reason.description.toLowerCase().includes(normalized))?.value || 'general_support';
}

function buildTicketPanelEmbed(settings) {
  const title = settings.ticket.panelTitle || 'Open a support ticket';
  const description = settings.ticket.panelDescription || 'Choose a reason from the dropdown below to open a private ticket with the support team.';
  const emoji = settings.ticket.panelEmoji || '🎫';

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${emoji} ${title}`)
    .setDescription(description);
}

function buildTicketStatsEmbed(settings) {
  const tickets = Object.values(settings.ticket.tickets || {});
  const openCount = tickets.filter((ticket) => ticket.status === 'open' || !ticket.status).length;
  const closedCount = tickets.filter((ticket) => ticket.status === 'closed').length;
  const deletedCount = tickets.filter((ticket) => ticket.status === 'deleting').length;
  const lastTicket = tickets
    .filter((ticket) => ticket.createdAt)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Ticket system stats')
    .setDescription('Current ticket counts and system status.')
    .addFields(
      { name: 'Open tickets', value: `${openCount}`, inline: true },
      { name: 'Closed tickets', value: `${closedCount}`, inline: true },
      { name: 'Deleted tickets', value: `${deletedCount}`, inline: true },
      { name: 'Support role', value: settings.ticket.supportRoleId ? `<@&${settings.ticket.supportRoleId}>` : 'Not configured', inline: false },
      { name: 'Panel channel', value: settings.ticket.panelChannelId ? `<#${settings.ticket.panelChannelId}>` : 'Not configured', inline: false },
      { name: 'Last ticket', value: lastTicket ? `<@${lastTicket.ownerId}> (${lastTicket.reasonLabel})` : 'No ticket history yet', inline: false }
    );
}

function buildReasonMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket-reason-select')
      .setPlaceholder('🎫 Choose a ticket reason')
      .addOptions(ticketReasons.map((reason) => new StringSelectMenuOptionBuilder().setLabel(reason.label).setValue(reason.value).setDescription(reason.description)))
  );
}

function buildTicketOpenButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-open').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
  );
}

function buildTicketCloseConfirmRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-close-confirm').setLabel('Confirm close').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket-close-cancel').setLabel('Cancel').setEmoji('❌').setStyle(ButtonStyle.Secondary)
  );
}

function buildClosedTicketButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-reopen').setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket-delete-transcript').setLabel('Delete and Transcript').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
}

function getTicketAccessRoleIds(settings) {
  return [...new Set([
    ...(settings.whitelist?.staffRoleIds || []),
    settings.ticket?.supportRoleId,
    ESCALATION_TICKET_ACCESS_ROLE_ID
  ].filter(Boolean))];
}

async function lockTicketChannel(channel, settings) {
  const ownerMatch = channel.topic?.match(/^ticket-owner:(\d+)$/);
  const ownerId = ownerMatch?.[1];

  await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => null);

  const accessRoleIds = getTicketAccessRoleIds(settings);

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false
    }).catch(() => null);
  }

  for (const roleId of accessRoleIds) {
    await channel.permissionOverwrites.edit(roleId, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false
    }).catch(() => null);
  }
}

async function reopenTicketChannel(channel, reopenedBy, settings) {
  const ownerMatch = channel.topic?.match(/^ticket-owner:(\d+)$/);
  const ownerId = ownerMatch?.[1];

  await channel.setName(channel.name.replace(/^closed-/, '').slice(0, 100)).catch(() => null);

  const accessRoleIds = getTicketAccessRoleIds(settings);

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      AttachFiles: true
    }).catch(() => null);
  }

  for (const roleId of accessRoleIds) {
    await channel.permissionOverwrites.edit(roleId, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true
    }).catch(() => null);
  }

  upsertTicketRecord(channel.guild.id, channel.id, {
    status: 'open',
    reopenedAt: Date.now(),
    reopenedBy: reopenedBy.id || reopenedBy.tag,
    closedAt: null,
    closedBy: null,
    closedReason: null
  });
}

async function createTicketChannel(guild, member, settings, reasonValue = 'general_support') {
  const nextCounter = Number(settings.ticket.counter || 0) + 1;
  const ticketNumber = String(nextCounter).padStart(4, '0');
  const channelName = `ticket-${ticketNumber}`;
  const botMemberId = guild.members.me?.id || guild.client.user.id;
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: member.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles]
    },
    {
      id: botMemberId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels]
    }
  ];

  for (const roleId of getTicketAccessRoleIds(settings)) {
    overwrites.push({
      id: roleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles]
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: settings.ticket.categoryId || null,
    topic: `ticket-owner:${member.id}`,
    permissionOverwrites: overwrites,
    reason: `Ticket created for ${member.user.tag}`
  });

  upsertTicketRecord(guild.id, channel.id, {
    ownerId: member.id,
    ownerTag: member.user.tag,
    reasonValue,
    reasonLabel: getReasonLabel(reasonValue),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    inactivityWhitelisted: false,
    participants: [member.id],
    events: []
  });

  updateGuildSettings(guild.id, (current) => ({
    ...current,
    ticket: {
      ...current.ticket,
      counter: nextCounter
    }
  }));

  return channel;
}

async function closeTicketChannel(channel, closedBy, reason, settings, options = {}) {
  const deleteChannel = Boolean(options.deleteChannel);
  const transcript = await buildTranscript(channel);
  const transcriptFile = new AttachmentBuilder(transcript.filePath);
  const ticketRecord = getTicketRecord(settings, channel.id);
  const summary = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🎫 Ticket closed')
    .setDescription([
      `Channel: ${channel.name}`,
      `Closed by: ${closedBy.tag}`,
      `Reason: ${reason || 'No reason provided'}`,
      `Messages saved: ${transcript.messageCount}`
    ].join('\n'))
    .setTimestamp();

  const logChannel = settings.ticket.logChannelId ? channel.guild.channels.cache.get(settings.ticket.logChannelId) : null;
  const destination = logChannel?.isTextBased() ? logChannel : channel;
  await destination.send({ embeds: [summary], files: [transcriptFile] }).catch(() => null);
  const recipients = new Set([ticketRecord?.ownerId, ...(ticketRecord?.participants || [])].filter(Boolean));

  for (const userId of recipients) {
    const user = await channel.client.users.fetch(userId).catch(() => null);
    if (!user) {
      continue;
    }

    await user.send({
      content: `Your ticket transcript for #${channel.name} is attached.`,
      files: [new AttachmentBuilder(transcript.filePath)]
    }).catch(() => null);
  }

  upsertTicketRecord(channel.guild.id, channel.id, {
    status: deleteChannel ? 'deleting' : 'closed',
    closedAt: Date.now(),
    closedBy: closedBy.id || closedBy.tag,
    closedReason: reason || 'No reason provided',
    inactivityReminderAt: null,
    inactivityReminderExpiresAt: null,
    lastActivityAt: Date.now()
  });

  if (deleteChannel) {
    clearTicketRecord(channel.guild.id, channel.id);
    await channel.delete(`Ticket deleted by ${closedBy.tag}`).catch(() => null);
    return;
  }

  await lockTicketChannel(channel, settings);

  const reopenNotice = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🎫 Ticket closed')
    .setDescription('This ticket is closed now. Use the buttons below if it needs to be reopened or removed.');

  await channel.send({ embeds: [reopenNotice], components: [buildClosedTicketButtonRow()] }).catch(() => null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket panel and ticket controls.')
    .addSubcommand((subcommand) => subcommand
      .setName('panel')
      .setDescription('Create a ticket panel.')
      .addChannelOption((option) => option.setName('channel').setDescription('Panel channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
      .addChannelOption((option) => option.setName('category').setDescription('Ticket category').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
      .addRoleOption((option) => option.setName('support_role').setDescription('Support role').setRequired(true))
      .addChannelOption((option) => option.setName('log_channel').setDescription('Transcript log channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
      .addStringOption((option) => option.setName('title').setDescription('Panel title').setRequired(false))
      .addStringOption((option) => option.setName('description').setDescription('Panel description').setRequired(false))
      .addStringOption((option) => option.setName('emoji').setDescription('Panel emoji').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('stats')
      .setDescription('Show ticket counts and current panel status.'))
    .addSubcommand((subcommand) => subcommand
      .setName('close')
      .setDescription('Close the current ticket.')
      .addStringOption((option) => option.setName('reason').setDescription('Close reason').setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName('whitelist')
      .setDescription('Whitelist the current ticket from inactivity auto-close.')
      .addBooleanOption((option) => option.setName('enabled').setDescription('Enable or disable inactivity whitelisting').setRequired(false))),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'panel') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
        await interaction.reply({ content: 'You need Manage Channels to use this command.', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const category = interaction.options.getChannel('category', true);
      const supportRole = interaction.options.getRole('support_role', true);
      const logChannel = interaction.options.getChannel('log_channel');

      const panelTitle = interaction.options.getString('title')?.trim() || settings.ticket.panelTitle || 'Open a support ticket';
      const panelDescription = interaction.options.getString('description')?.trim() || settings.ticket.panelDescription || 'Choose a reason from the dropdown below to open a private ticket with the support team.';
      const panelEmoji = interaction.options.getString('emoji')?.trim() || settings.ticket.panelEmoji || '🎫';

      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        ticket: {
          ...settings.ticket,
          categoryId: category.id,
          supportRoleId: supportRole.id,
          logChannelId: logChannel?.id || settings.ticket.logChannelId,
          panelChannelId: channel.id,
          panelTitle,
          panelDescription,
          panelEmoji
        }
      }));

      const embed = buildTicketPanelEmbed(getGuildSettings(interaction.guild.id));

      const panelMessage = await channel.send({ embeds: [embed], components: [buildReasonMenu(), buildTicketOpenButtonRow()] });

      updateGuildSettings(interaction.guild.id, (settings) => ({
        ...settings,
        ticket: {
          ...settings.ticket,
          panelMessageId: panelMessage.id
        }
      }));

      await interaction.reply({ content: `Ticket panel created in ${channel}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'stats') {
      await interaction.reply({ embeds: [buildTicketStatsEmbed(settings)], ephemeral: true });
      return;
    }

    if (subcommand === 'whitelist') {
      const ticketRecord = getTicketRecord(settings, interaction.channel.id);

      if (!isTicketChannel(interaction.channel) || !ticketRecord) {
        await interaction.reply({ content: 'This command only works inside a ticket channel.', ephemeral: true });
        return;
      }

      const enabled = interaction.options.getBoolean('enabled');
      const currentSetting = enabled === null ? true : enabled;

      upsertTicketRecord(interaction.guild.id, interaction.channel.id, {
        inactivityWhitelisted: currentSetting
      });

      await interaction.reply({ content: `Ticket inactivity whitelist ${currentSetting ? 'enabled' : 'disabled'}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'close') {
      const ticketOwnerMatch = interaction.channel.topic?.match(/^ticket-owner:(\d+)$/);
      const isOwner = ticketOwnerMatch?.[1] === interaction.user.id;
      const isStaff = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(getGuildSettings(interaction.guild.id).ticket.supportRoleId);

      if (!isOwner && !isStaff) {
        await interaction.reply({ content: 'You are not allowed to close this ticket.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Ticket is being closed.', ephemeral: true }).catch(() => null);
      await closeTicketChannel(interaction.channel, interaction.user, interaction.options.getString('reason') || 'Closed via slash command', getGuildSettings(interaction.guild.id));
      return;
    }
  },
  async handleButton(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const ticketRecord = getTicketRecord(settings, interaction.channel.id);

    if (interaction.customId === 'ticket-open') {
      if (!settings.ticket.categoryId || !settings.ticket.supportRoleId) {
        await interaction.reply({ content: 'Ticket system is not configured yet.', ephemeral: true });
        return;
      }

      const existingTicket = interaction.guild.channels.cache.find((channel) => channel.topic === `ticket-owner:${interaction.user.id}`);
      if (existingTicket) {
        await interaction.reply({ content: `You already have an open ticket: ${existingTicket}`, ephemeral: true });
        return;
      }

      const ticketChannel = await createTicketChannel(interaction.guild, interaction.member, settings, 'general_support');
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎫 Ticket created')
        .setDescription('Explain your issue clearly. A support member will join shortly.')
        .addFields({ name: 'Controls', value: 'Use the buttons below to claim, close, or delete the ticket after the transcript is sent.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket-claim').setLabel('Claim').setEmoji('🧑‍💼').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket-delete-transcript').setLabel('Delete and Transcript').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `${interaction.user} <@&${settings.ticket.supportRoleId}>`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `Your ticket is ready: ${ticketChannel}`, ephemeral: true });
      return;
    }

    if (interaction.customId === 'ticket-close') {
      const ticketOwnerMatch = interaction.channel.topic?.match(/^ticket-owner:(\d+)$/);
      const isOwner = ticketOwnerMatch?.[1] === interaction.user.id;
      const isStaff = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId);

      if (!isOwner && !isStaff) {
        await interaction.reply({ content: 'You are not allowed to close this ticket.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Are you sure you want to close this ticket?', ephemeral: true, components: [buildTicketCloseConfirmRow()] }).catch(() => null);
      return;
    }

    if (interaction.customId === 'ticket-close-confirm') {
      const ticketOwnerMatch = interaction.channel.topic?.match(/^ticket-owner:(\d+)$/);
      const isOwner = ticketOwnerMatch?.[1] === interaction.user.id;
      const isStaff = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId);

      if (!isOwner && !isStaff) {
        await interaction.reply({ content: 'You are not allowed to close this ticket.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Closing ticket...', ephemeral: true }).catch(() => null);
      if (interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId)) {
        updateStaffStat(interaction.guild.id, interaction.user.id, (current) => ({
          ...current,
          ticketsHandled: (current.ticketsHandled || 0) + 1
        }));
      }
      await closeTicketChannel(interaction.channel, interaction.user, 'Closed via button', settings);
      return;
    }

    if (interaction.customId === 'ticket-close-cancel') {
      await interaction.reply({ content: 'Ticket close canceled.', ephemeral: true }).catch(() => null);
      return;
    }

    if (interaction.customId === 'ticket-reopen') {
      const ticketOwnerMatch = interaction.channel.topic?.match(/^ticket-owner:(\d+)$/);
      const isOwner = ticketOwnerMatch?.[1] === interaction.user.id;
      const isStaff = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId);

      if (!isOwner && !isStaff) {
        await interaction.reply({ content: 'You are not allowed to reopen this ticket.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Reopening ticket...', ephemeral: true }).catch(() => null);
      await reopenTicketChannel(interaction.channel, interaction.user, settings);

      await interaction.channel.send({
        embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('🎫 Ticket reopened').setDescription(`Reopened by ${interaction.user.tag}. Continue the conversation here.`)],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket-claim').setLabel('Claim').setEmoji('🧑‍💼').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-delete-transcript').setLabel('Delete and Transcript').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        )]
      }).catch(() => null);
      return;
    }

    if (interaction.customId === 'ticket-delete-transcript') {
      const ticketOwnerMatch = interaction.channel.topic?.match(/^ticket-owner:(\d+)$/);
      const isOwner = ticketOwnerMatch?.[1] === interaction.user.id;
      const isStaff = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId);

      if (!isOwner && !isStaff) {
        await interaction.reply({ content: 'You are not allowed to delete this ticket.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Deleting ticket and sending transcript...', ephemeral: true }).catch(() => null);
      if (interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId)) {
        updateStaffStat(interaction.guild.id, interaction.user.id, (current) => ({
          ...current,
          ticketsHandled: (current.ticketsHandled || 0) + 1
        }));
      }
      await closeTicketChannel(interaction.channel, interaction.user, 'Deleted with transcript', settings, { deleteChannel: true });
      return;
    }

    if (interaction.customId === 'ticket-claim') {
      if (!ticketRecord) {
        await interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });
        return;
      }

      const claimedBy = ticketRecord.claimedBy || [];

      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) && !interaction.member.roles.cache.has(settings.ticket.supportRoleId)) {
        await interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
        return;
      }

      if (claimedBy.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You already claimed this ticket.', ephemeral: true });
        return;
      }

      if (claimedBy.length >= 3) {
        await interaction.reply({ content: 'This ticket already has the maximum 3 claims.', ephemeral: true });
        return;
      }

      upsertTicketRecord(interaction.guild.id, interaction.channel.id, {
        claimedBy: [...claimedBy, interaction.user.id]
      });

      updateStaffStat(interaction.guild.id, interaction.user.id, (current) => ({
        ...current,
        claims: (current.claims || 0) + 1
      }));

      const updatedTicket = getTicketRecord(getGuildSettings(interaction.guild.id), interaction.channel.id);
      await interaction.reply({ content: `Ticket claimed by ${interaction.user.tag}.`, ephemeral: true });
      await interaction.channel.send({ content: `Claim trail: ${(updatedTicket.claimedBy || []).map((userId, index) => `${index + 1}. <@${userId}>`).join(' | ')}` }).catch(() => null);
      return;
    }

    if (interaction.customId === 'ticket-inactivity-continue') {
      if (!ticketRecord) {
        await interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });
        return;
      }

      upsertTicketRecord(interaction.guild.id, interaction.channel.id, {
        inactivityReminderAt: null,
        inactivityReminderExpiresAt: null,
        lastActivityAt: Date.now()
      });

      await interaction.reply({ content: 'Ticket kept open. Continue the conversation here.', ephemeral: true });
      await interaction.channel.send({ content: `${interaction.user} chose to continue this ticket.` }).catch(() => null);
      return;
    }

    if (interaction.customId === 'ticket-inactivity-close') {
      await interaction.reply({ content: 'Closing inactive ticket...', ephemeral: true }).catch(() => null);
      if (interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels) || interaction.member.roles.cache.has(settings.ticket.supportRoleId)) {
        updateStaffStat(interaction.guild.id, interaction.user.id, (current) => ({
          ...current,
          ticketsHandled: (current.ticketsHandled || 0) + 1
        }));
      }
      await closeTicketChannel(interaction.channel, interaction.user, 'Inactive ticket closed by user choice', settings);
    }
  },
  async handleSelect(interaction) {
    if (interaction.customId !== 'ticket-reason-select') {
      return;
    }

    const settings = getGuildSettings(interaction.guild.id);
    const selectedReason = interaction.values[0];

    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    if (selectedReason === 'staff_apply') {
      await interaction.editReply({ content: 'Staff applications are currently closed.' }).catch(() => null);
      return;
    }

    const existingTicket = interaction.guild.channels.cache.find((channel) => channel.topic === `ticket-owner:${interaction.user.id}`);
    if (existingTicket) {
      await interaction.editReply({ content: `You already have an open ticket: ${existingTicket}` }).catch(() => null);
      return;
    }

    const ticketChannel = await createTicketChannel(interaction.guild, interaction.member, settings, selectedReason);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🎫 Ticket created: ${getReasonLabel(selectedReason)}`)
      .setDescription('Explain your issue clearly. A support member will join shortly.')
      .addFields(
        { name: 'Claim limit', value: 'Up to 3 staff members can claim this ticket.' },
        { name: 'Controls', value: 'Use Close to lock the ticket or Delete and Transcript to remove it after the transcript is delivered.' }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket-claim').setLabel('Claim').setEmoji('🧑‍💼').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket-delete-transcript').setLabel('Delete and Transcript').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );

    const supportRoleMention = settings.ticket.supportRoleId ? `<@&${settings.ticket.supportRoleId}>` : 'Support staff';
    await ticketChannel.send({ content: `${interaction.user} ${supportRoleMention}`, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `Your ticket is ready: ${ticketChannel}` }).catch(() => null);
  },
  async handlePrefixSetup(message, channel, supportRole, category) {
    const logChannel = message.mentions.channels.find((entry) => entry.id !== channel.id && entry.type !== ChannelType.GuildCategory) || null;
    const settings = getGuildSettings(message.guild.id);
    const panelTitle = settings.ticket.panelTitle || 'Open a support ticket';
    const panelDescription = settings.ticket.panelDescription || 'Press the button below to create a private ticket with the support team.';
    const panelEmoji = settings.ticket.panelEmoji || '🎫';

    updateGuildSettings(message.guild.id, (settings) => ({
      ...settings,
      ticket: {
        ...settings.ticket,
        categoryId: category.id,
        supportRoleId: supportRole.id,
        logChannelId: logChannel?.id || settings.ticket.logChannelId,
        panelChannelId: channel.id,
        panelTitle,
        panelDescription,
        panelEmoji
      }
    }));

    const embed = buildTicketPanelEmbed(getGuildSettings(message.guild.id));

    const panelMessage = await channel.send({ embeds: [embed], components: [buildReasonMenu(), buildTicketOpenButtonRow()] });

    updateGuildSettings(message.guild.id, (settings) => ({
      ...settings,
      ticket: {
        ...settings.ticket,
        panelMessageId: panelMessage.id
      }
    }));

    await message.reply(`Ticket panel created in ${channel}.`);
  },
  async handlePrefixClose(message) {
    const settings = getGuildSettings(message.guild.id);
    if (!message.channel.topic?.startsWith('ticket-owner:')) {
      await message.reply('This does not look like a ticket channel.').catch(() => null);
      return;
    }

    await message.reply('Closing ticket...').catch(() => null);
    await closeTicketChannel(message.channel, message.author, 'Closed via prefix command', settings);
  },
  async handleMessage(message, args = []) {
    const [subcommand] = args.slice(1);

    if (subcommand === 'panel') {
      const channel = message.mentions.channels.find((entry) => entry.id !== message.channel.id && entry.type !== ChannelType.GuildCategory) || message.channel;
      const supportRole = message.mentions.roles.first();
      const category = message.mentions.channels.find((entry) => entry.type === ChannelType.GuildCategory);

      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        await message.reply('You need Manage Channels to use this command.').catch(() => null);
        return;
      }

      if (!supportRole || !category) {
        await message.reply('Usage: !ticket panel #panel-channel @support-role #category').catch(() => null);
        return;
      }

      await this.handlePrefixSetup(message, channel, supportRole, category);
      return;
    }

    if (subcommand === 'open') {
      const settings = getGuildSettings(message.guild.id);

      if (!settings.ticket.categoryId || !settings.ticket.supportRoleId) {
        await message.reply('The ticket system is not configured yet.').catch(() => null);
        return;
      }

      const requestedReason = args.slice(2).join(' ').trim() || 'general_support';
      const selectedReason = findTicketReason(requestedReason);
      const existingTicket = message.guild.channels.cache.find((channel) => channel.topic === `ticket-owner:${message.author.id}`);

      if (existingTicket) {
        await message.reply({ content: `You already have an open ticket: ${existingTicket}`, allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
      }

      const ticketChannel = await createTicketChannel(message.guild, message.member, settings, selectedReason);
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`🎫 Ticket created: ${getReasonLabel(selectedReason)}`)
        .setDescription('Explain your issue clearly. A support member will join shortly.')
        .addFields({ name: 'Controls', value: 'Use the buttons below to claim, close, or delete the ticket after the transcript is sent.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket-claim').setLabel('Claim').setEmoji('🧑‍💼').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket-delete-transcript').setLabel('Delete and Transcript').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `${message.author} <@&${settings.ticket.supportRoleId}>`, embeds: [embed], components: [row] });
      await message.reply({ content: `Your ticket is ready: ${ticketChannel}`, allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'stats') {
      const settings = getGuildSettings(message.guild.id);
      await message.reply({ embeds: [buildTicketStatsEmbed(settings)], allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    if (subcommand === 'close') {
      await this.handlePrefixClose(message);
      return;
    }

    if (subcommand === 'whitelist') {
      const settings = getGuildSettings(message.guild.id);
      const ticketRecord = getTicketRecord(settings, message.channel.id);

      if (!isTicketChannel(message.channel) || !ticketRecord) {
        await message.reply('This command only works inside a ticket channel.').catch(() => null);
        return;
      }

      const enabled = message.content.toLowerCase().includes('true') || !message.content.toLowerCase().includes('false');

      upsertTicketRecord(message.guild.id, message.channel.id, {
        inactivityWhitelisted: enabled
      });

      await message.reply(`Ticket inactivity whitelist ${enabled ? 'enabled' : 'disabled'}.`).catch(() => null);
      return;
    }

    if (subcommand === 'reopen') {
      const settings = getGuildSettings(message.guild.id);
      const ticketRecord = getTicketRecord(settings, message.channel.id);

      if (!isTicketChannel(message.channel) || !ticketRecord) {
        await message.reply('This command only works inside a ticket channel.').catch(() => null);
        return;
      }

      const ticketOwnerMatch = message.channel.topic?.match(/^ticket-owner:(\d+)$/);
      const isOwner = ticketOwnerMatch?.[1] === message.author.id;
      const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) || message.member.roles.cache.has(settings.ticket.supportRoleId);

      if (!isOwner && !isStaff) {
        await message.reply('You are not allowed to reopen this ticket.').catch(() => null);
        return;
      }

      await reopenTicketChannel(message.channel, message.author, settings);
      await message.reply('Ticket reopened.').catch(() => null);
      return;
    }
  },
  closeTicketChannel
};