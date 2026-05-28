# BUG Empire Bot

Discord bot scaffold for the BUG EMPIRE server.

## Features

- Ticket panels with transcript export on close
- Basic moderation: ban, kick, timeout, purge, and blocked words
- Welcome and leave messages
- Autorole and reaction-role support
- Bot voice cleanup when a bot is left alone in VC
- Basic anti-nuke guard using audit log activity
- Broadcast / announcement command

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your bot token and client ID.

3. Deploy slash commands to your server:

   ```bash
   npm run deploy
   ```

4. Start the bot:

   ```bash
   npm start
   ```

## Notes

- Set `DISCORD_GUILD_ID` to `1274360936748290108` to deploy commands to your server only.
- The anti-nuke guard is a basic safety layer, not a full replacement for a dedicated security bot.