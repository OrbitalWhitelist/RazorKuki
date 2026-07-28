import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { runLoginAction } from '../../lib/actions';
import { buildErrorEmbed } from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('login')
  .setDescription('Validating & Checking')
  
  .addStringOption((opt) =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const result = await runLoginAction(rawCookie);
    if (result.success) {
      await interaction.editReply({ embeds: [result.embed] });
    } else {
      await interaction.editReply({ embeds: [result.embed] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Login command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const loginCommand: Command = { data, execute };