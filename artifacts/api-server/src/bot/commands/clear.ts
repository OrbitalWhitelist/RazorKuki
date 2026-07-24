import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear Cookies Format')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('input')
      .setDescription('Insert The Cookies!')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raw = interaction.options.getString('input', true);
    const cleaned = Roblox.extractCookie(raw);
    if (!cleaned) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **No Cookie Found**\n────\n⭑ No valid cookie token found.')] });
      return;
    }

    const id = Math.random().toString(36).slice(2, 10);
    const row = buildCopyButtons(id, 'clear', cleaned, false);
    const embed = buildSuccessEmbed(
      '✧ **Cleaned Cookie**\n' +
      `────\n` +
      `\`\`\`\n${cleaned}\n\`\`\`\n` +
      `────\n` +
      `⭑ Removed warning prefix and extra text.`
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err: any) {
    logger.error({ err }, 'Clear command error');
    await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const clearCommand: Command = { data, execute, handleButton };