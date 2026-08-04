import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { buildErrorEmbed } from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('checkv2')
  .setDescription('Mass Credential Check (W.I.P)')
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing credentials')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const embed = buildErrorEmbed(
      '✧ **Commands ini kekurangan dana!**\n' +
      `────\n` +
      `⭑ Fitur ini sedang dalam pengembangan.\n` +
      `⭑ Mohon tunggu update selanjutnya.`
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    logger.error({ err }, 'CheckV2 command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const checkv2Command: Command = { data, execute };