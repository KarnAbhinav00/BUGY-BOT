const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { purgeMessages } = require('../utils/mod-actions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages.')
    .addIntegerOption((option) => option.setName('amount').setDescription('Messages to delete').setMinValue(1).setMaxValue(100).setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await interaction.reply({ content: 'You need Manage Messages to use this command.', ephemeral: true });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const deleted = await purgeMessages(interaction.channel, amount);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Messages purged').setDescription(`Deleted ${deleted} messages.`)], ephemeral: true });
  },
  async handleMessage(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await message.reply({ content: 'You need Manage Messages to use that command.', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const amount = Number(message.content.split(/\s+/)[1]);
    if (!Number.isFinite(amount) || amount < 1) {
      await message.reply({ content: 'Usage: !purge 10', allowedMentions: { repliedUser: false } }).catch(() => null);
      return;
    }

    const deleted = await purgeMessages(message.channel, amount);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Messages purged').setDescription(`Deleted ${deleted} messages.`)], allowedMentions: { repliedUser: false } }).catch(() => null);
  }
};