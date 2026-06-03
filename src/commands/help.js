const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { requestFooter } = require('../utils/embed');

const categories = {
  general: {
    label: 'General',
    description: 'Basic bot commands and quick help',
    title: 'General Commands',
    commands: ['`/ping` - check latency', '`/help` - open this panel', '`@bot help` - mention the bot for help', '`?ping` - fast latency check', '`?help` - fast help']
  },
  shortcuts: {
    label: 'Shortcuts',
    description: 'Fast prefix commands for staff',
    title: 'Prefix Shortcuts',
    commands: ['`?si` / `?serverinfo` - quick server overview', '`?ss` / `?serverstats` - detailed server stats', '`?ci` / `?channelinfo` - inspect a channel', '`?ri` / `?roleinfo` - inspect a role', '`?perm` / `?permissions` - check bot permissions in a channel', '`?bw` / `?badwords list` - view the banned words list', '`?notes add @user text` - store a staff note', '`?notes list @user` - list notes for a member', '`?notes remove @user 1` - remove a stored note', '`?escalate @role` - grant a role ticket access', '`?lock` - lock the current channel', '`?unlock` - unlock the current channel', '`?slowmode 10` - set slowmode in seconds', '`?topic new text` - update the current channel topic', '`?ticket panel` - create the ticket panel', '`?ticket open` - open a ticket directly', '`?ticket stats` - show ticket counts', '`?close-ticket` - close the current ticket']
  },
  ticket: {
    label: 'Tickets',
    description: 'Open and manage support tickets',
    title: 'Ticket Commands',
    commands: ['`/ticket panel` - create the ticket panel', '`/ticket close` - close the current ticket', '`/ticket inactivity` - set inactivity timeout for tickets', '`/ticket whitelist` - disable inactivity auto-close on a ticket', 'Ticket buttons: `Claim`, `Close`, `Delete and Transcript`']
  },
  moderation: {
    label: 'Moderation',
    description: 'Staff-only moderation tools',
    title: 'Moderation Commands',
    commands: ['`/ban` - ban a member', '`/kick` - kick a member', '`/timeout` - timeout a member', '`/purge` - delete recent messages', '`/warn` - warn a member', '`/badwords` - view and manage banned words', '`/escalate` - grant a role ticket access', 'Reply shortcuts: `k 2d reason`, `t 2d reason`, `b 455d reason`']
  },
  server: {
    label: 'Server Tools',
    description: 'Protection, whitelist, hierarchy and channel control',
    title: 'Server Tools',
    commands: ['`/config` - manage words, links, greeting and punishments', '`/hierarchy` - view the configured role hierarchy', '`/whitelist` - manage trusted roles and users', '`/antinuke` - configure anti-nuke protection', '`/profile` - view staff stats', '`/prefix list` - view current prefixes', '`/prefix add` - add a new prefix', '`/prefix remove` - remove a prefix', '`/server info` - server overview', '`/server lock` - lock a channel', '`/server unlock` - unlock a channel', '`/server slowmode` - set slowmode', '`/server topic` - set a channel topic', '`/serverstats` - detailed server stats', '`/channelinfo` - inspect a channel', '`/roleinfo` - inspect a role', '`/whois` - inspect a member', '`/notes` - manage staff notes', '`/help` - command categories and descriptions']
  }
};

function buildHelpEmbed(categoryKey, username) {
  const category = categories[categoryKey] || categories.general;
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`EmpireGuard | ${category.title}`)
    .setDescription(category.commands.join('\n'))
    .setFooter(requestFooter(username));
}

function buildMenu(defaultValue = 'general') {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help-categories')
      .setPlaceholder('Choose a command category')
      .addOptions(
        Object.entries(categories).map(([value, category]) => ({
          label: value === 'general' ? '✨ General' : value === 'shortcuts' ? '⚡ Shortcuts' : value === 'ticket' ? '🎫 Tickets' : value === 'moderation' ? '🛡️ Moderation' : '⚙️ Server Tools',
          description: category.description,
          value,
          default: value === defaultValue
        }))
      )
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show the bot command menu.'),
  async execute(interaction) {
    await interaction.reply({
      embeds: [buildHelpEmbed('general', interaction.user.username)],
      components: [buildMenu('general')],
      ephemeral: true
    });
  },
  async handleSelect(interaction) {
    const selected = interaction.values[0] || 'general';
    await interaction.update({
      embeds: [buildHelpEmbed(selected, interaction.user.username)],
      components: [buildMenu(selected)]
    });
  },
  async handleMessage(message) {
    await message.reply({
      embeds: [buildHelpEmbed('general', message.author.username)],
      components: [buildMenu('general')]
    }).catch(() => null);
  }
};