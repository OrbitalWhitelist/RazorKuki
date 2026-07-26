import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildProgressEmbed } from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('cp')
  .setDescription('Change Password Directly')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

    const validation = await Roblox.validateCookie(rawCookie);
    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const userId = validation.userId!;
    const twoFactor = await Roblox.checkTwoFactorStatus(rawCookie, String(userId));
    if (twoFactor.enabled) {
      const embed = buildErrorEmbed(
        `✧ **2FA Detected**\n────\n` +
        `⭑ Authenticator is enabled on this account.\n` +
        `⭑ Password change is blocked for security.\n` +
        `⭑ Please disable 2FA first or use the official Roblox interface.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Changing password...');
    await interaction.editReply({ embeds: [progressEmbed] });

    const result = await Roblox.changePassword(rawCookie, currentPassword, newPassword);
    if (result.success) {
      const embed = buildSuccessEmbed(
        '✧ **Password Changed**\n' +
        `────\n` +
        `⭑ Your password has been updated successfully.\n` +
        `⭑ Your credentials were not logged.`
      );
      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = buildErrorEmbed(
        `✧ **Change Failed**\n────\n` +
        `⭑ ${result.error || 'Unknown error'}\n` +
        `⭑ Please check your current password and try again.`
      );
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err: any) {
    logger.error({ err }, 'CP command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const cpCommand: Command = { data, execute };