import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import { refreshCookie, type RefreshResult } from '../roblox';

const cookieStore = new Map<string, { cookie: string; timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cookieStore) {
    if (now - entry.timestamp > 10 * 60 * 1000) cookieStore.delete(key);
  }
}, 60_000);

function storeAndBuildRow(cookie: string): { id: string; row: ActionRowBuilder<ButtonBuilder> } {
  const id = Math.random().toString(36).substring(2, 10);
  cookieStore.set(id, { cookie, timestamp: Date.now() });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cookie_mobile_${id}`)
      .setLabel('📱 Mobile Copy')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cookie_pc_${id}`)
      .setLabel('💻 PC Copy')
      .setStyle(ButtonStyle.Secondary),
  );
  return { id, row };
}

export const refreshCookieCommand = new SlashCommandBuilder()
  .setName('rcookie')
  .setDescription('Re-session a Roblox cookie')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('The full .ROBLOSECURITY cookie').setRequired(true),
  );

export async function handleRefreshCookie(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString('cookie', true).trim();

  let result: RefreshResult | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    result = await refreshCookie(cookie);
    if (result.newCookie) break;
  }

  if (!result?.newCookie) {
    const status = result?.status ?? 'unknown';
    const debugBlock = result?.debug ? `\n\`\`\`\n${result.debug}\n\`\`\`` : '';
    await interaction.editReply(`❌ **Refresh failed** — \`${status}\`${debugBlock}`);
    return;
  }

  const { row } = storeAndBuildRow(result.newCookie);
  await interaction.editReply({
    content: '✅ **Cookie re-sessioned!** Use the buttons to copy it.',
    components: [row],
  });
}

export async function handleButtonInteraction(interaction: MessageComponentInteraction): Promise<void> {
  const { customId } = interaction;
  const mobileMatch = customId.match(/^cookie_mobile_(.+)$/);
  const pcMatch = customId.match(/^cookie_pc_(.+)$/);
  const match = mobileMatch || pcMatch;
  if (!match) return;

  const entry = cookieStore.get(match[1]);
  if (!entry) {
    await interaction.reply({ content: '❌ Cookie expired — run the command again.', ephemeral: true });
    return;
  }

  const cookie = entry.cookie;
  if (mobileMatch) {
    await interaction.reply({ content: `\`${cookie}\``, ephemeral: true });
  } else {
    await interaction.reply({ content: `\`\`\`\n${cookie}\n\`\`\``, ephemeral: true });
  }
}
