import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
} from 'discord.js';
import { logger } from '../lib/logger';
import { botState } from './status';
import { refreshCookieCommand, handleRefreshCookie, handleButtonInteraction } from './commands/refresh-cookie';
import { logCookieCommand, handleLogCookie } from './commands/log-cookie';
import { ccheckerCommand, handleCchecker } from './commands/cchecker';

const COMMANDS = [refreshCookieCommand, logCookieCommand, ccheckerCommand];

export async function startBot(): Promise<void> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const allowedGuildId = process.env['GUILD_ID'];

  if (!token) {
    logger.warn('DISCORD_BOT_TOKEN is not set — bot will not start');
    return;
  }
  if (!allowedGuildId) {
    logger.error('GUILD_ID is not set — refusing to start without a guild whitelist');
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [] } });

  client.once('clientReady', async (c) => {
    botState.online = true;
    botState.tag = c.user.tag;
    botState.readyAt = new Date();
    logger.info({ tag: c.user.tag }, '⚔️  Razor Tools bot is online');

    const rest = new REST({ version: '10' }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(c.application.id), {
        body: COMMANDS.map(cmd => cmd.toJSON()),
      });
      logger.info({ count: COMMANDS.length }, 'Global slash commands registered');
    } catch (err) {
      logger.error({ err }, 'Failed to register slash commands');
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      if (interaction.guildId !== allowedGuildId) {
        await interaction.reply({ content: '⛔ This bot is private and not authorized here.', ephemeral: true });
        logger.warn({ guildId: interaction.guildId, userId: interaction.user.id, command: interaction.commandName }, 'Blocked unauthorized guild');
        return;
      }

      const ownerIds = (process.env['OWNER_IDS'] ?? '').split(',').map(id => id.trim()).filter(Boolean);
      if (ownerIds.length > 0 && !ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '⛔ You are not authorized to use Razor Tools.', ephemeral: true });
        logger.warn({ userId: interaction.user.id, command: interaction.commandName }, 'Blocked unauthorized user');
        return;
      }

      try {
        switch (interaction.commandName) {
          case 'rcookie': await handleRefreshCookie(interaction); break;
          case 'log': await handleLogCookie(interaction); break;
          case 'cchecker': await handleCchecker(interaction); break;
          default: logger.warn({ command: interaction.commandName }, 'Unknown command');
        }
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, 'Command error');
        const msg = { content: '❌ An unexpected error occurred.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  });

  client.on('error', err => logger.error({ err }, 'Discord client error'));
  client.on('shardDisconnect', () => { botState.online = false; logger.warn('Bot disconnected'); });

  await client.login(token);
}
