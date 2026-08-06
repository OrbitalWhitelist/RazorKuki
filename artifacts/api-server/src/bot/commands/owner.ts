import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { execSync } from 'child_process';
import { logger } from '../../lib/logger';
import type { Command } from './types';
import { buildPanelEmbed, buildPanelSelect } from './panel';

const ownerIds = (process.env.OWNER_IDS || '').split(',').filter(Boolean);

function isOwner(userId: string): boolean {
  return ownerIds.includes(userId);
}

const data = new SlashCommandBuilder()
  .setName('owner')
  .setDescription('Owner tools (only for bot owners)')
  .addSubcommand(sub =>
    sub.setName('panel')
      .setDescription('Send the control panel to a channel')
      .addChannelOption(opt =>
        opt.setName('channel').setDescription('Target channel').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('send')
      .setDescription('Send a message as the bot')
      .addChannelOption(opt =>
        opt.setName('channel').setDescription('Target channel').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('message').setDescription('Message to send').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('update')
      .setDescription('Pull latest code, rebuild, and restart')
  )
  .addSubcommand(sub =>
    sub.setName('restart')
      .setDescription('Restart the bot')
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: '❌ Owner only.', flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'panel') {
    const channel = interaction.options.getChannel('channel', true);
    if (channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ Must be a text channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await (channel as TextChannel).send({
        embeds: [buildPanelEmbed()],
        components: [buildPanelSelect()],
      });
      await interaction.editReply(`✅ Panel sent to ${channel}.`);
    } catch (err: any) {
      logger.error(err, 'Owner panel error');
      await interaction.editReply('❌ Failed to send panel.');
    }
    return;
  }

  if (subcommand === 'send') {
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);
    if (channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ Must be a text channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await (channel as TextChannel).send(message);
      await interaction.editReply(`✅ Message sent to ${channel}.`);
    } catch (err: any) {
      logger.error(err, 'Owner send error');
      await interaction.editReply('❌ Failed to send message.');
    }
    return;
  }

  if (subcommand === 'update') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      execSync('git pull && pnpm run build', { stdio: 'inherit' });
      await interaction.editReply('✅ Code updated and built. Restarting...');
      process.exit(0);
    } catch (err: any) {
      logger.error(err, 'Update failed');
      await interaction.editReply('❌ Update failed. Check logs.');
    }
    return;
  }

  if (subcommand === 'restart') {
    await interaction.reply({ content: '🔁 Restarting...', flags: MessageFlags.Ephemeral });
    process.exit(0);
  }
}

export const ownerCommand: Command = { data, execute };