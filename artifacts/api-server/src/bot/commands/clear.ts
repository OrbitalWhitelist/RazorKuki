import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const clearStore = new Map<string, string>();

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear Cookies Format')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('input')
      .setDescription('Raw cookie text with extra characters')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raw = interaction.options.getString('input', true);
    const cleaned = Roblox.extractCookie(raw);
    if (!cleaned) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **No Cookie Found**\n────\n⭑ No `.ROBLOSECURITY` token found in the provided text.')] });
      return;
    }

    const id = Math.random().toString(36).slice(2, 10);
    clearStore.set(id, cleaned);
    setTimeout(() => clearStore.delete(id), 300000);

    const embed = buildSuccessEmbed(
      '✧ **Cleaned Cookie**\n' +
      `────\n` +
      `\`\`\`\n${cleaned}\n\`\`\`\n` +
      `────\n` +
      `⭑ Removed warning prefix and extra text.`
    );
    const row = buildCopyButtons(id, 'clear');
    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err: any) {
    logger.error({ err }, 'Clear command error');
    await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    if (!customId.startsWith('clear_')) return;
    const parts = customId.split('_');
    const action = parts[1];
    const id = parts[2];
    const cookie = clearStore.get(id);
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
    logger.error({ err }, 'Clear button error');
    await interaction.reply({ content: '𖣐 Error', flags: MessageFlags.Ephemeral });
  }
}

export const clearCommand: Command = { data, execute, handleButton };