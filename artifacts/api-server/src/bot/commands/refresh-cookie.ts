import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import { refreshCookie, killSessions } from '../roblox';
import { successHeader, errorHeader, warnLine, ansiBlock } from '../ui';
import type { Command } from './types';

// ─── In-memory cookie store (10-min TTL) ──────────────────────────────────

const cookieStore = new Map<string, { cookie: string; timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cookieStore) {
    if (now - entry.timestamp > 10 * 60 * 1000) cookieStore.delete(key);
  }
}, 60_000);

// ─── Shared helpers ────────────────────────────────────────────────────────

export function storeAndBuildRow(cookie: string): ActionRowBuilder<ButtonBuilder> {
  const id = Math.random().toString(36).substring(2, 10);
  cookieStore.set(id, { cookie, timestamp: Date.now() });
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`cookie_mobile_${id}`).setLabel('📱 Mobile Copy').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cookie_pc_${id}`).setLabel('💻 PC Copy').setStyle(ButtonStyle.Secondary),
  );
}

export async function handleButtonInteraction(interaction: MessageComponentInteraction): Promise<void> {
  const { customId } = interaction;
  const mobileMatch = customId.match(/^cookie_mobile_(.+)$/);
  const pcMatch     = customId.match(/^cookie_pc_(.+)$/);
  const match       = mobileMatch ?? pcMatch;
  if (!match) return;

  const entry = cookieStore.get(match[1]);
  if (!entry) {
    await interaction.reply({ content: errorHeader('Cookie Expired', 'Run the command again.'), ephemeral: true });
    return;
  }

  if (mobileMatch) {
    await interaction.reply({ content: `\`${entry.cookie}\``, ephemeral: true });
  } else {
    await interaction.reply({ content: `\`\`\`\n${entry.cookie}\n\`\`\``, ephemeral: true });
  }
}

// ─── Command definition ────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('rcookie')
  .setDescription('Re-session a Roblox cookie (soft refresh → kill old sessions)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie')
      .setDescription('The .ROBLOSECURITY cookie (full or bare CAEQ… value)')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const oldCookie = interaction.options.getString('cookie', true).trim();

  // ── Step 1: Soft-refresh to obtain a new session token ──────────────────
  let newCookie: string | null = null;
  let refreshDebug = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await refreshCookie(oldCookie);
    refreshDebug = r.debug;
    if (r.newCookie) { newCookie = r.newCookie; break; }
    if (r.status === 'COOKIE_EXPIRED') break; // no point retrying
  }

  if (!newCookie) {
    await interaction.editReply(
      errorHeader('Re-session Failed', 'The cookie may be expired or the refresh endpoint rejected it.') +
      `\n\`\`\`\n${refreshDebug}\n\`\`\``,
    );
    return;
  }

  // ── Step 2: Kill all sessions on the OLD cookie ──────────────────────────
  const killResult = await killSessions(oldCookie);
  const killOk = killResult.status === 'SUCCESS';

  const subtitle = killOk
    ? 'Old sessions killed. Use the buttons to copy your new cookie.'
    : 'Could not kill old sessions — but new cookie is ready.';

  const content = successHeader('Cookie Re-Sessioned', subtitle) +
    (killOk ? '' : '\n' + warnLine(`Kill status: ${killResult.status}`));

  await interaction.editReply({ content, components: [storeAndBuildRow(newCookie)] });
}

export const rcookieCommand: Command = { data, execute, handleButton: handleButtonInteraction };
