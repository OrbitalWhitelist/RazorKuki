import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
} from 'discord.js';
import { logger } from '../lib/logger';
import { botState } from './status';
import { resetCommand } from './commands/reset';
import { loginCommand } from './commands/login';
import { checkCommand } from './commands/check';
import { bypassCommand } from './commands/bypass';
import { clearCommand } from './commands/clear';
import type { Command } from './commands/types';

const COMMANDS: Command[] = [
  resetCommand,
  loginCommand,
  checkCommand,
  bypassCommand,
  clearCommand,
];

const registry = new Collection<string, Command>();
for (const cmd of COMMANDS) registry.set(cmd.data.name, cmd);

export async function startBot(): Promise<void> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const allowedGuildId = process.env['GUILD_ID'];

  if (!token) {
    logger.warn('DISCORD_BOT_TOKEN not set — bot will not start');
    return;
  }
  if (!allowedGuildId) {
    logger.error('GUILD_ID not set — refusing to start without a guild whitelist');
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [] },
  });

  client.once('clientReady', async (c) => {
    botState.online = true;
    botState.tag = c.user.tag;
    botState.readyAt = new Date();
    logger.info({ tag: c.user.tag }, '⚔️  Razor Tools bot is online');

    const rest = new REST({ version: '10' }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(c.application.id), {
        body: COMMANDS.map((cmd) => cmd.data.toJSON()),
      });
      logger.info({ count: COMMANDS.length }, 'Global slash commands registered');
    } catch (err) {
      logger.error({ err }, 'Failed to register slash commands');
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      if (interaction.guildId !== allowedGuildId) {
        await interaction.reply({ content: '⛔ This bot is private.', ephemeral: true });
        logger.warn({ guildId: interaction.guildId, userId: interaction.user.id }, 'Blocked unauthorized guild');
        return;
      }

      const ownerIds = (process.env['OWNER_IDS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (ownerIds.length > 0 && !ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '⛔ You are not authorized to use Razor Tools.', ephemeral: true });
        logger.warn({ userId: interaction.user.id, command: interaction.commandName }, 'Blocked unauthorized user');
        return;
      }

      const command = registry.get(interaction.commandName);
      if (!command) {
        logger.warn({ command: interaction.commandName }, 'Unknown command received');
        return;
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, 'Command execution error');
        const msg = { content: '❌ An unexpected error occurred.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
    } else if (interaction.isButton()) {
      const customId = interaction.customId;
      let handled = false;

      for (const command of registry.values()) {
        if (!command.handleButton) continue;
        const prefixMap: Record<string, string> = {
          reset: 'reset_',
          bypass: 'bypass_',
        };
        const prefix = prefixMap[command.data.name];
        if (prefix && customId.startsWith(prefix)) {
          try {
            await command.handleButton(interaction);
            handled = true;
            break;
          } catch (err) {
            logger.error({ err, command: command.data.name }, 'Button handler error');
          }
        }
      }

      if (!handled) {
        await interaction.reply({ content: '⛔ Unknown button interaction.', ephemeral: true });
        logger.warn({ customId }, 'Unhandled button interaction');
      }
    }
  });

  client.on('error', (err) => logger.error({ err }, 'Discord client error'));
  client.on('shardDisconnect', () => {
    botState.online = false;
    logger.warn('Bot disconnected');
  });

  await client.login(token);
}