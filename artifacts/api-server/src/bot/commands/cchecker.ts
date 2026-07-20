import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import axios from 'axios';
import { validateCookie, formatAccountCard } from '../roblox';
import { storeAndBuildRow } from './refresh-cookie';

const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/g;
const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/g;

function extractCookies(text: string): string[] {
  const fullMatches = [...text.matchAll(FULL_COOKIE_RE)].map(m => m[0]);
  const fullBareValues = new Set(
    fullMatches.map(m => {
      const idx = m.indexOf('|_CAEQ') + 2;
      return m.slice(idx);
    }),
  );

  const bareMatches = [...text.matchAll(BARE_COOKIE_RE)]
    .map(m => m[0])
    .filter(v => !fullBareValues.has(v));

  const seen = new Set<string>();
  const result: string[] = [];

  for (const full of fullMatches) {
    const bare = (() => { const idx = full.indexOf('|_CAEQ') + 2; return full.slice(idx); })();
    if (!seen.has(bare)) { seen.add(bare); result.push(full); }
  }
  for (const bare of bareMatches) {
    if (!seen.has(bare)) { seen.add(bare); result.push(bare); }
  }

  return result;
}

export const ccheckerCommand = new SlashCommandBuilder()
  .setName('cchecker')
  .setDescription('Check a .txt file for valid Roblox cookies')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption(opt =>
    opt.setName('file').setDescription('A .txt file containing cookies').setRequired(true),
  );

export async function handleCchecker(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const attachment = interaction.options.getAttachment('file', true);

  if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
    await interaction.editReply('❌ Please attach a `.txt` file.');
    return;
  }

  let fileContent: string;
  try {
    const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
    fileContent = resp.data;
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to download file: ${err.message}`);
    return;
  }

  const cookies = extractCookies(fileContent);

  if (cookies.length === 0) {
    await interaction.editReply('⚠️ No Roblox cookies found in the file.\nCookies must start with `_|WARNING...|_CAEQ` or be a bare `CAEQ...` token.');
    return;
  }

  await interaction.editReply(`🔍 Found **${cookies.length}** cookie(s). Checking…`);

  let validCount = 0;

  for (const cookie of cookies) {
    const result = await validateCookie(cookie);
    if (!result.valid) continue;

    validCount++;
    const row = storeAndBuildRow(cookie);

    await interaction.followUp({
      content: `✅ **Valid Cookie #${validCount}**\n\n${formatAccountCard(result)}`,
      components: [row],
      ephemeral: true,
    });
  }

  const summary = validCount === 0
    ? `✅ Done — no valid cookies found out of **${cookies.length}** checked.`
    : `✅ Done — **${validCount} valid** / ${cookies.length} total.`;

  await interaction.followUp({ content: summary, ephemeral: true });
}
