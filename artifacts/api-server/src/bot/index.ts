import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
  MessageFlags,
} from 'discord.js';
import { logger } from '../lib/logger';
import { botState } from './status';
import { resetCommand } from './commands/reset';
import { loginCommand } from './commands/login';
import { checkCommand } from './commands/check';
import { bypassCommand } from './commands/bypass';
import { clearCommand } from './commands/clear';
import { panelCommand } from './commands/panel';
import { runpanelCommand } from './commands/runpanel';
import { sendCommand } from './commands/send';
import type { Command } from './commands/types';

const COMMANDS: Command[] = [
  resetCommand,
  loginCommand,
  checkCommand,
  bypassCommand,
  clearCommand,
  panelCommand,
  runpanelCommand,
  sendCommand,
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
        await interaction.reply({ content: '⛔ This bot is private.', flags: MessageFlags.Ephemeral });
        return;
      }

      const ownerIds = (process.env['OWNER_IDS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (ownerIds.length > 0 && !ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '⛔ You are not authorized.', flags: MessageFlags.Ephemeral });
        return;
      }

      const command = registry.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, 'Command error');
        const msg = { content: '❌ An error occurred.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
    } else if (interaction.isButton()) {
      const customId = interaction.customId;
      if (customId.startsWith('panel_')) {
        await panelCommand.handleButton?.(interaction);
      } else if (customId.startsWith('reset_')) {
        await resetCommand.handleButton?.(interaction);
      } else if (customId.startsWith('clear_')) {
        await clearCommand.handleButton?.(interaction);
      } else if (customId.startsWith('bypass_')) {
        await bypassCommand.handleButton?.(interaction);
      } else if (customId.startsWith('check_')) {
        await checkCommand.handleButton?.(interaction);
      } else {
        await interaction.reply({ content: 'Unknown button.', flags: MessageFlags.Ephemeral });
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'panel_select') {
        await panelCommand.handleSelect?.(interaction);
      } else {
        await interaction.reply({ content: 'Unknown select menu.', flags: MessageFlags.Ephemeral });
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('panel_modal_')) {
        await panelCommand.handleModal?.(interaction);
      }
    }
  });

  client.on('error', (err) => logger.error({ err }, 'Client error'));
  client.on('shardDisconnect', () => {
    botState.online = false;
    logger.warn('Bot disconnected');
  });

  await client.login(token);
}