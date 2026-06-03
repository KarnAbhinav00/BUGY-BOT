const { ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../config');
const { getGuildSettings } = require('../storage/guild-settings');
const { appendTicketEvent, isTicketChannel, touchTicketActivity } = require('../utils/ticket-history');
const { isLockdownActive } = require('../utils/raid-heat');
const { isWhitelistedMember } = require('../utils/permissions');
const { banMember, kickMember, timeoutMember, parseDuration } = require('../utils/mod-actions');
const { logModerationAction } = require('../utils/mod-log');
const { recordStaffMessage } = require('../utils/staff-stats');

const spamTracker = new Map();
const SPAM_WINDOW_MS = 15_000;
const SPAM_REPEAT_THRESHOLD = 3;
const SPAM_INITIAL_TIMEOUT_MINUTES = 5;
const SPAM_MAX_TIMEOUT_MINUTES = 60;

function getMentionPrefix(clientUserId) {
  return new RegExp(`^<@!?${clientUserId}>\\s*`, 'i');
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function normalizeSpamContent(content) {
  return String(content || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getSpamMuteDuration(message) {
  const content = message.content?.trim() || '';
  const attachments = message.attachments?.size ? [...message.attachments.values()].map((attachment) => attachment.url).sort().join('|') : '';
  const normalized = content ? normalizeSpamContent(content) : attachments ? `attachment:${attachments}` : '';

  if (!normalized) {
    return null;
  }

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const record = spamTracker.get(key) || { content: null, count: 0, lastAt: 0, lastMuteDuration: 0, lastMuteAt: 0 };

  if (record.content === normalized && now - record.lastAt <= SPAM_WINDOW_MS) {
    record.count += 1;
  } else {
    record.content = normalized;
    record.count = 1;
  }

  record.lastAt = now;

  if (record.count >= SPAM_REPEAT_THRESHOLD) {
    const baseTimeout = record.lastMuteDuration || SPAM_INITIAL_TIMEOUT_MINUTES;
    const timeoutMinutes = Math.min(record.lastMuteDuration ? Math.min(baseTimeout * 2, SPAM_MAX_TIMEOUT_MINUTES) : SPAM_INITIAL_TIMEOUT_MINUTES, SPAM_MAX_TIMEOUT_MINUTES);

    record.lastMuteDuration = timeoutMinutes;
    record.lastMuteAt = now;
    record.count = 0;
    spamTracker.set(key, record);
    return timeoutMinutes;
  }

  spamTracker.set(key, record);
  return null;
}

function isDurationToken(value) {
  const text = String(value || '').trim().toLowerCase();
  return parseDuration(text) !== null || ['perm', 'permanent', 'forever', '455d'].includes(text);
}

async function handleReplyShortcut(message, settings) {
  if (!message.reference?.messageId) {
    return false;
  }

  const tokens = message.content.trim().split(/\s+/);
  const command = tokens[0]?.toLowerCase();
  const referencedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
  const targetMember = referencedMessage ? await message.guild.members.fetch(referencedMessage.author.id).catch(() => null) : null;

  if (!targetMember) {
    return false;
  }

  const canModerate = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    || message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    || isWhitelistedMember(message.member, settings);

  if (!canModerate) {
    return false;
  }

  const [, maybeTime, ...reasonParts] = tokens;

  if (command === 'k' || command === 'kick') {
    const reason = (isDurationToken(maybeTime) ? reasonParts : [maybeTime, ...reasonParts]).filter(Boolean).join(' ') || 'No reason provided';
    await kickMember(targetMember, reason);
    await logModerationAction(message.guild, settings, {
      action: 'Kick',
      target: `${targetMember.user.tag} (${targetMember.user.id})`,
      moderator: message.author.tag,
      reason,
      channel: `${message.channel.name || message.channel.id}`
    });
    await message.reply({ content: `👢 Kicked ${targetMember.user.tag}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
    return true;
  }

  if (command === 't' || command === 'timeout') {
    const time = isDurationToken(maybeTime) ? maybeTime : '60m';
    const reason = (isDurationToken(maybeTime) ? reasonParts : [maybeTime, ...reasonParts]).filter(Boolean).join(' ') || 'No reason provided';
    await timeoutMember(targetMember, time, reason);
    await logModerationAction(message.guild, settings, {
      action: 'Timeout',
      target: `${targetMember.user.tag} (${targetMember.user.id})`,
      moderator: message.author.tag,
      reason,
      duration: time,
      channel: `${message.channel.name || message.channel.id}`
    });
    await message.reply({ content: `⏳ Timed out ${targetMember.user.tag} for ${time}.`, allowedMentions: { repliedUser: false } }).catch(() => null);
    return true;
  }

  if (command === 'b' || command === 'ban') {
    const time = isDurationToken(maybeTime) ? maybeTime : '455d';
    const reason = (isDurationToken(maybeTime) ? reasonParts : [maybeTime, ...reasonParts]).filter(Boolean).join(' ') || 'No reason provided';
    await banMember(message, targetMember.user, time, reason);
    await logModerationAction(message.guild, settings, {
      action: 'Ban',
      target: `${targetMember.user.tag} (${targetMember.user.id})`,
      moderator: message.author.tag,
      reason,
      duration: time,
      channel: `${message.channel.name || message.channel.id}`
    });
    await message.reply({ content: `🚫 Banned ${targetMember.user.tag} (${time}).`, allowedMentions: { repliedUser: false } }).catch(() => null);
    return true;
  }

  if (command === 'w' || command === 'warn') {
    const reason = ([maybeTime, ...reasonParts]).filter(Boolean).join(' ') || 'No reason provided';
    await logModerationAction(message.guild, settings, {
      action: 'Warn',
      target: `${targetMember.user.tag} (${targetMember.user.id})`,
      moderator: message.author.tag,
      reason,
      channel: `${message.channel.name || message.channel.id}`
    });
    await message.reply({ content: `⚠️ Warned ${targetMember.user.tag}: ${reason}`, allowedMentions: { repliedUser: false } }).catch(() => null);
    return true;
  }

  return false;
}

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (!message.guild || message.author.bot) {
      return;
    }

    const settings = getGuildSettings(message.guild.id);
    const protection = settings.protection || {};
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) || message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    recordStaffMessage(message.member, settings);

    const prefixes = Array.isArray(settings.prefixes) && settings.prefixes.length
      ? settings.prefixes.map((value) => String(value || '').trim()).filter(Boolean)
      : [(settings.prefix || config.defaultPrefix).trim()];
    const mentionPrefix = getMentionPrefix(message.client.user.id);
    const matchedPrefix = prefixes.find((candidate) => message.content.startsWith(candidate));
    const isMentionCommand = mentionPrefix.test(message.content);
    const commandText = matchedPrefix
      ? message.content.slice(matchedPrefix.length).trim()
      : isMentionCommand
        ? message.content.replace(mentionPrefix, '').trim()
        : '';

    const commandAliases = {
      si: 'serverinfo',
      ss: 'serverstats',
      ci: 'channelinfo',
      ri: 'roleinfo',
      perm: 'permissions',
      botperm: 'permissions',
      bw: 'badwords',
      n: 'notes',
      tkt: 'ticket',
      ti: 'ticket',
      h: 'help',
      px: 'prefix',
      listprefix: 'prefix',
      addprefix: 'prefix',
      removeprefix: 'prefix'
    };
    const [rawCommand] = commandText.split(/\s+/);
    const aliasCommand = commandAliases[rawCommand?.toLowerCase()] || rawCommand?.toLowerCase();
    const args = commandText.split(/\s+/);

    if (isTicketChannel(message.channel)) {
      appendTicketEvent(message.guild.id, message.channel.id, {
        type: 'message',
        messageId: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content,
        attachments: [...message.attachments.values()].map((attachment) => attachment.url),
        timestamp: Date.now()
      });
      touchTicketActivity(message.guild.id, message.channel.id);
    }

    if (!isAdmin && !isWhitelistedMember(message.member, settings)) {
      const spamTimeoutMinutes = getSpamMuteDuration(message);
      if (spamTimeoutMinutes) {
        if (message.member?.moderatable) {
          await message.member.timeout(spamTimeoutMinutes * 60_000, 'Auto spam mute').catch(() => null);
          await logModerationAction(message.guild, settings, {
            action: 'Spam mute',
            target: `${message.author.tag} (${message.author.id})`,
            moderator: message.client.user.tag,
            reason: 'Repeated identical messages detected',
            duration: `${spamTimeoutMinutes} minute(s)`,
            channel: `${message.channel.name || message.channel.id}`
          });
          await message.channel.send({ content: `${message.author}, you have been muted for ${spamTimeoutMinutes} minute(s) due to repeated spam.`, allowedMentions: { repliedUser: false } }).catch(() => null);
        }
        return;
      }
    }

    if (!commandText && protection.enabled !== false && isLockdownActive(settings) && !isWhitelistedMember(message.member, settings) && !isAdmin) {
      if (message.deletable) {
        await message.delete().catch(() => null);
      }

      if (message.member?.moderatable) {
        await message.member.timeout((Number(protection.timeoutMinutes || 60)) * 60000, 'Raid lockdown active').catch(() => null);
      }

      return;
    }

    if (await handleReplyShortcut(message, settings)) {
      return;
    }

    const blockedWords = new Set([...(settings.blockedWords || [])]);
    const blockedLinks = new Set([...(settings.blockedLinks || [])]);
    const content = normalizeText(message.content);
    const matchedWord = [...blockedWords].find((word) => word && content.includes(normalizeText(word)));
    const matchedLink = [...blockedLinks].find((link) => link && content.includes(normalizeText(link)));
    const matchedValue = matchedWord || matchedLink;

    if (matchedValue) {
      const isLink = Boolean(matchedLink);
      const shouldDelete = isLink ? protection.deleteLinks !== false : protection.deleteBadWords !== false;
      const shouldTimeout = isLink ? protection.timeoutForLinks !== false : protection.timeoutForWords !== false;

      if (shouldDelete && message.deletable) {
        await message.delete().catch(() => null);
      }

      if (shouldTimeout && message.member?.moderatable) {
        await message.member.timeout((Number(protection.timeoutMinutes || 60)) * 60000, `Auto protection: ${matchedValue}`).catch(() => null);
        await logModerationAction(message.guild, settings, {
          action: 'Auto moderation',
          target: `${message.author.tag} (${message.author.id})`,
          moderator: message.client.user.tag,
          reason: `Matched blocked ${isLink ? 'link' : 'word'}: ${matchedValue}`,
          duration: `${Number(protection.timeoutMinutes || 60)} minute(s)`,
          channel: `${message.channel.name || message.channel.id}`
        });
      }

      const logChannel = protection.logChannelId
        ? message.guild.channels.cache.get(protection.logChannelId)
        : settings.moderationLogChannelId
          ? message.guild.channels.cache.get(settings.moderationLogChannelId)
          : null;

      const replyText = `${message.author}, that content is not allowed here.`;

      if (logChannel?.isTextBased()) {
        await logChannel.send({ content: `${replyText}\nMatched: ${matchedValue}\nDeleted a message from ${message.author.tag}: ${message.content}` }).catch(() => null);
      }

      await message.channel.send({ content: replyText }).catch(() => null);
      return;
    }

    if (isMentionCommand && !aliasCommand) {
      await message.client.commands.get('help')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'help') {
      await message.client.commands.get('help')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'ping') {
      await message.client.commands.get('ping')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'server' || aliasCommand === 'serverinfo' || ['lock', 'unlock', 'slowmode', 'topic'].includes(aliasCommand)) {
      const serverCommand = message.client.commands.get('server');

      if (serverCommand?.handleMessage) {
        const serverArgs = aliasCommand === 'serverinfo'
          ? ['info', ...args.slice(1)]
          : args;

        await serverCommand.handleMessage(message, serverArgs);
      }

      return;
    }

    if (aliasCommand === 'permissions' || aliasCommand === 'botperms') {
      await message.client.commands.get('permissions')?.handleMessage(message, args);
      return;
    }

    if (aliasCommand === 'badwords' || aliasCommand === 'badword') {
      await message.client.commands.get('badwords')?.handleMessage(message, args);
      return;
    }

    if (aliasCommand === 'notes' || aliasCommand === 'note') {
      await message.client.commands.get('notes')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'serverstats' || aliasCommand === 'guildstats') {
      await message.client.commands.get('serverstats')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'channelinfo') {
      await message.client.commands.get('channelinfo')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'roleinfo') {
      await message.client.commands.get('roleinfo')?.handleMessage(message);
      return;
    }

    if (aliasCommand === 'escalate' || aliasCommand === 'promote') {
      await message.client.commands.get('escalate')?.handleMessage(message, args);
      return;
    }

    if (aliasCommand === 'prefix') {
      await message.client.commands.get('prefix')?.handleMessage(message, args);
      return;
    }

    if (aliasCommand === 'close-ticket') {
      await message.client.commands.get('ticket')?.handlePrefixClose(message);
      return;
    }

    if (aliasCommand === 'setup-ticket') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return;
      }

      const channel = message.mentions.channels.first() || message.channel;
      const supportRole = message.mentions.roles.first();
      const category = message.mentions.channels.find((entry) => entry.type === ChannelType.GuildCategory);

      if (!supportRole || !category) {
        await message.reply('Usage: !setup-ticket #panel-channel @support-role #category').catch(() => null);
        return;
      }

      await message.client.commands.get('ticket')?.handlePrefixSetup(message, channel, supportRole, category);
      return;
    }

    const genericCommand = message.client.commands.get(aliasCommand);
    if (genericCommand?.handleMessage) {
      await genericCommand.handleMessage(message, args);
      return;
    }

    if (commandText) {
      await message.reply({ content: `I couldn't recognize that command. Use @${message.client.user.username} help or ${matchedPrefix || config.defaultPrefix}help.`, allowedMentions: { repliedUser: false } }).catch(() => null);
    }

    return;

  }
};
