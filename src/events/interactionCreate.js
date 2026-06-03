module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'Something went wrong while running that command.', ephemeral: true });
          return;
        }

        await interaction.reply({ content: 'Something went wrong while running that command.', ephemeral: true });
      }

      return;
    }

    if (interaction.isStringSelectMenu()) {
      const helpCommand = client.commands.get('help');

      if (interaction.customId === 'help-categories' && helpCommand?.handleSelect) {
        await helpCommand.handleSelect(interaction);
        return;
      }

      if (interaction.customId === 'ticket-reason-select') {
        const ticketCommand = client.commands.get('ticket');

        if (ticketCommand?.handleSelect) {
          await ticketCommand.handleSelect(interaction);
        }
      }

      return;
    }

    if (!interaction.isButton()) {
      return;
    }

    if (interaction.customId.startsWith('ticket-')) {
      const ticketCommand = client.commands.get('ticket');

      if (ticketCommand?.handleButton) {
        await ticketCommand.handleButton(interaction);
      }
      return;
    }

    if (interaction.customId.startsWith('welcome-')) {
      const welcomeCommand = client.commands.get('welcome');

      if (welcomeCommand?.handleButton) {
        await welcomeCommand.handleButton(interaction);
      }
      return;
    }
  }
};