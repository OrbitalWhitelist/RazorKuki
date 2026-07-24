import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildProgressEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const resetStore = new Map<string, string>();

const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset Cookie Session')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('The .ROBLOSECURITY cookie').setRequired(true)
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

    const result = await Roblox.killAndRefreshSession(rawCookie);
    if (result.success && result.newCookie) {
      const id = Math.random().toString(36).slice(2, 10);
      resetStore.set(id, result.newCookie);
      setTimeout(() => resetStore.delete(id), 300000);

      const embed = buildSuccessEmbed(
        '✧ **Reset Successful**\n' +
        `────\n` +
        `⭑ New cookie issued.\n` +
        `⭑ Old session killed.\n` +
        `⭑ Your credentials were not logged.`
      );
      const row = buildCopyButtons(id, 'reset');
      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Reset Failed**\n────\n⭑ Could not refresh the session. Please try again later.')] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Reset command error');
    await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    if (!customId.startsWith('reset_')) return;
    const parts = customId.split('_');
    const action = parts[1];
    const id = parts[2];
    const cookie = resetStore.get(id);
    if (!cookie) {
      await interaction.reply({ content: '𖣐 This button has expired.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (action === 'copypc') {
      await interaction.reply({ content: `\`\`\`\n${cookie}\n\`\`\``, flags: MessageFlags.Ephemeral });
    } else if (action === 'copymob') {
      await interaction.reply({ content: `\`${cookie}\``, flags: MessageFlags.Ephemeral });
    }
  } catch (err: any) {
    logger.error({ err }, 'Reset button error');
    await interaction.reply({ content: '𖣐 Error', flags: MessageFlags.Ephemeral });
  }
}

export const resetCommand: Command = { data, execute, handleButton };