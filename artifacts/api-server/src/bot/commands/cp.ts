import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { runChangePasswordAction } from '../../lib/actions';
import { buildErrorEmbed } from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('cp')
  .setDescription('Change Password Directly')
  
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('current_password').setDescription('Current password').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('new_password').setDescription('New password').setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const currentPassword = interaction.options.getString('current_password', true);
    const newPassword = interaction.options.getString('new_password', true);

    const result = await runChangePasswordAction(rawCookie, currentPassword, newPassword);
    await interaction.editReply({ embeds: [result.embed] });
  } catch (err: any) {
    logger.error({ err }, 'CP command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const cpCommand: Command = { data, execute };