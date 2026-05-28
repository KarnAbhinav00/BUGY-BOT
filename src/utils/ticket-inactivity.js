const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getAllGuildSettings, updateGuildSettings } = require('../storage/guild-settings');
const { closeTicketChannel } = require('../commands/ticket');
const { getTicketRecord, setTicketReminder } = require('./ticket-history');

function buildReminderEmbed(channel, minutes) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Ticket inactivity check')
    .setDescription([
      `This ticket has been inactive for a while.`,
      `Reply in the next ${minutes} minutes or press Continue to keep it open.`,
      `If nobody responds, the ticket will close automatically.`
    ].join('\n'));
}

async function sendReminder(channel, ticketRecord, minutes) {
  const embed = buildReminderEmbed(channel, minutes);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-inactivity-continue').setLabel('Continue Ticket').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket-inactivity-close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: ticketRecord?.ownerId ? `<@${ticketRecord.ownerId}>` : undefined,
    embeds: [embed],
    components: [row]
  }).catch(() => null);

  if (ticketRecord?.ownerId) {
    const user = await channel.client.users.fetch(ticketRecord.ownerId).catch(() => null);
    if (user) {
      await user.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

async function runTicketInactivitySweep(client) {
  const settingsByGuild = getAllGuildSettings();
  const now = Date.now();

  for (const [guildId, settings] of Object.entries(settingsByGuild)) {
    const tickets = settings.ticket?.tickets || {};
    const inactiveMinutes = Number(settings.ticket?.inactivityMinutes || 30);
    const reminderMinutes = Number(settings.ticket?.inactivityReminderMinutes || 10);

    for (const [channelId, ticketRecord] of Object.entries(tickets)) {
      if (!ticketRecord || ticketRecord.inactivityWhitelisted || ticketRecord.status === 'closed' || ticketRecord.status === 'deleting') {
        continue;
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        continue;
      }

      const lastActivityAt = Number(ticketRecord.lastActivityAt || ticketRecord.createdAt || now);
      const idleMinutes = (now - lastActivityAt) / 60000;

      if (!ticketRecord.inactivityReminderAt && idleMinutes >= inactiveMinutes) {
        await sendReminder(channel, ticketRecord, reminderMinutes);
        setTicketReminder(guildId, channelId, {
          inactivityReminderAt: now,
          inactivityReminderExpiresAt: now + reminderMinutes * 60000
        });
        continue;
      }

      if (ticketRecord.inactivityReminderAt && ticketRecord.inactivityReminderExpiresAt && now >= ticketRecord.inactivityReminderExpiresAt) {
        const refreshedRecord = getTicketRecord(settings, channelId);
        if (!refreshedRecord || refreshedRecord.inactivityWhitelisted) {
          continue;
        }

        const latestActivityAt = Number(refreshedRecord.lastActivityAt || refreshedRecord.createdAt || now);
        if (latestActivityAt > Number(ticketRecord.inactivityReminderAt || 0)) {
          continue;
        }

        const ownerUser = await client.users.fetch(refreshedRecord.ownerId).catch(() => null);
        await channel.send({ content: 'No reply received. Closing the ticket now.' }).catch(() => null);
        await closeTicketChannel(channel, ownerUser || { tag: 'System' }, 'Inactive ticket auto-closed', settings).catch(() => null);
      }
    }
  }
}

module.exports = {
  runTicketInactivitySweep
};