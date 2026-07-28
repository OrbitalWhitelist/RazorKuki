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
import { refreshCommand } from './commands/refresh';
import { cpCommand } from './commands/cp';
import { checkv2Command } from './commands/checkv2';
import { panelCommand } from './commands/panel';
import { handleRunPanel, handleSend } from './commands/prefix';
import type { Command } from './commands/types';
import { checkCooldown } from '../lib/cooldown';
import { startHeartbeat } from '../lib/heartbeat';

const COMMANDS: Command[] = [
  resetCommand,
  loginCommand,
  checkCommand,
  bypassCommand,
  clearCommand,
  refreshCommand,
  cpCommand,
  checkv2Command,
];

const registry = new Collection<string, Command>();
for (const cmd of COMMANDS) registry.set(cmd.data.name, cmd);

const COOLDOWN_DESTRUCTIVE = 30000;

export async function startBot(): Promise<void> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const allowedGuildId = process.env['GUILD_ID'];

  const ownerIds = (process.env['OWNER_IDS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ownerIds.length === 0) {
    logger.warn('OWNER_IDS is empty — prefix commands (!runpanel, !send) will be disabled.');
  } else {
    logger.info({ ownerIds }, 'OWNER_IDS loaded for prefix commands');
  }

  if (!token) {
    logger.warn('DISCORD_BOT_TOKEN not set — bot will not start');
    return;
  }
  if (!allowedGuildId) {
    logger.error('GUILD_ID not set — refusing to start without a guild whitelist');
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages],
    allowedMentions: { parse: [] },
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    if (!message.guildId || message.guildId !== allowedGuildId) return;

    if (ownerIds.length === 0) {
      logger.warn('Prefix command ignored because OWNER_IDS is empty');
      return;
    }
    if (!ownerIds.includes(message.author.id)) {
      logger.warn({ userId: message.author.id }, 'Unauthorized user attempted prefix command');
      return;
    }

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    try {
      if (command === 'runpanel') {
        const channelMention = args[0];
        if (!channelMention) {
          await message.reply('❌ Please provide a channel mention, e.g. `!runpanel #channel`');
          return;
        }
        const channelId = channelMention.replace(/[<#>]/g, '');
        const channel = message.guild?.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) {
          await message.reply('❌ Invalid channel.');
          return;
        }
        await handleRunPanel(channel);
        await message.reply(`✅ Panel sent to ${channel}`);
      } else if (command === 'send') {
        const channelMention = args[0];
        if (!channelMention) {
          await message.reply('❌ Please provide a channel mention, e.g. `!send #channel Hello`');
          return;
        }
        const channelId = channelMention.replace(/[<#>]/g, '');
        const channel = message.guild?.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) {
          await message.reply('❌ Invalid channel.');
          return;
        }
        const content = args.slice(1).join(' ');
        if (!content) {
          await message.reply('❌ Please provide a message to send.');
          return;
        }
        await handleSend(channel, content);
        await message.reply(`✅ Message sent to ${channel}`);
      }
    } catch (err) {
      logger.error({ err, command }, 'Prefix command error');
      await message.reply('❌ An error occurred while processing your command.');
    }
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

    const heartbeatChannelId = process.env['HEARTBEAT_CHANNEL_ID'];
    const heartbeatInterval = parseInt(process.env['HEARTBEAT_INTERVAL_HOURS'] ?? '6');
    if (heartbeatChannelId) {
      startHeartbeat(client, heartbeatChannelId, heartbeatInterval);
      logger.info({ channelId: heartbeatChannelId, intervalHours: heartbeatInterval }, 'Heartbeat started');
    } else {
      logger.info('No HEARTBEAT_CHANNEL_ID set, heartbeat disabled');
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      if (interaction.guildId !== allowedGuildId) {
        await interaction.reply({ content: '⛔ This bot is private.', flags: MessageFlags.Ephemeral });
        return;
      }

      const command = registry.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
        return;
      }

      const destructiveCommands = ['reset', 'bypass', 'cp'];
      if (destructiveCommands.includes(interaction.commandName)) {
        const cooldown = checkCooldown(interaction.user.id, COOLDOWN_DESTRUCTIVE);
        if (!cooldown.allowed) {
          await interaction.reply({
            content: `⏳ Please wait ${cooldown.remainingSeconds}s before using this command again.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
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
      } else if (customId.startsWith('refresh_')) {
        await refreshCommand.handleButton?.(interaction);
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