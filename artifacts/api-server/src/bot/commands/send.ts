import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('send')
  .setDescription('Send a custom message with fake emojis')
  .setDefaultMemberPermissions('0')
  .addStringOption(opt =>
    opt.setName('message')
      .setDescription('The message to send')
      .setRequired(true)
  )
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Channel to send to (default: current)')
      .setRequired(false)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = interaction.options.getString('message', true);
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({ content: '❌ Invalid channel.' });
      return;
    }

    // Replace fake emoji patterns
    const formatted = message
      .replace(/:Verification:/g, '<:Verification:1118968927377182771>')
      .replace(/:verification:/g, '<:Verification:1118968927377182771>');

    await channel.send({ content: formatted });
    await interaction.editReply({ content: `✅ Message sent to ${channel}` });
  } catch (err: any) {
    logger.error({ err }, 'Send command error');
    await interaction.editReply({ content: '❌ Failed to send message.' });
  }
}

export const sendCommand: Command = { data, execute };