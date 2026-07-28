import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import { runResetAction } from '../../lib/actions';
import { buildErrorEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset Current Cookie')
  
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const rawCookie = interaction.options.getString('cookie', true);
    const result = await runResetAction(rawCookie);
    if (result.success && result.newCookie) {
      const id = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(id, 'reset', result.newCookie, false);
      await interaction.editReply({ embeds: [result.embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [result.embed] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Reset command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const resetCommand: Command = { data, execute, handleButton };