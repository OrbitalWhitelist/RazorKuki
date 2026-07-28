import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import { runClearAction } from '../../lib/actions';
import { buildErrorEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear Cookies Format')
  
  .addStringOption(opt =>
    opt.setName('input')
      .setDescription('Insert The Cookies!')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raw = interaction.options.getString('input', true);
    const result = await runClearAction(raw);
    if (result.success && result.cleanedCookie) {
      const id = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(id, 'clear', result.cleanedCookie, false);
      await interaction.editReply({ embeds: [result.embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [result.embed] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Clear command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const clearCommand: Command = { data, execute, handleButton };