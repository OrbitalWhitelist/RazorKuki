import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import axios from 'axios';
import { validatePassword } from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildProgressEmbed,
  buildBaseEmbed,
} from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('checkv2')
  .setDescription('Mass check username:password credentials from a .txt file')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing credentials (format: username:password:ip optional)')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const attachment = interaction.options.getAttachment('file', true);
    if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
      const embed = buildErrorEmbed('✧ **Invalid File**\n────\n⭑ Please attach a `.txt` file.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let fileContent: string;
    try {
      const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
      fileContent = resp.data;
    } catch (err: any) {
      logger.error({ err }, 'File download failed in checkv2');
      const embed = buildErrorEmbed('✧ **Download Failed**\n────\n⭑ Could not fetch the file. Please try again.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const lines = fileContent.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      const embed = buildErrorEmbed('✧ **No Lines Found**\n────\n⭑ The file is empty.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed(`Scanning ${lines.length} credential(s)...`);
    await interaction.editReply({ embeds: [progressEmbed] });

    let validCount = 0;
    const total = lines.length;

    for (const rawLine of lines) {
      const parts = rawLine.split(':');
      if (parts.length < 2) continue;
      const username = parts[0];
      const password = parts[1];
      const result = await validatePassword(username, password);
      if (!result.valid) continue;

      validCount++;
      const embed = buildBaseEmbed(
        '𖣐 Valid Credential',
        `✧ **Username:** ${username}\n` +
        `⭑ **Password:** ${'*'.repeat(password.length)}\n` +
        `⭑ **Status:** ✅ Valid`
      );
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const summaryEmbed = buildSuccessEmbed(
      validCount === 0
        ? `✧ **Results**\n────\n⭑ Checked ${total} credential(s)\n⭑ **Valid:** 0\n⭑ All are invalid.`
        : `✧ **Results**\n────\n⭑ Checked ${total} credential(s)\n⭑ **Valid:** ${validCount}`
    );
    await interaction.followUp({ embeds: [summaryEmbed], flags: MessageFlags.Ephemeral });
  } catch (err: any) {
    logger.error({ err }, 'CheckV2 command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const checkv2Command: Command = { data, execute };