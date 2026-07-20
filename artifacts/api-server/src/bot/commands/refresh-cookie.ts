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
import { successEmbed, errorEmbed, warnEmbed } from '../ui';
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
    await interaction.reply({
      embeds: [errorEmbed('Cookie Expired', 'Run the command again — stored cookies expire after 10 minutes.')],
      ephemeral: true,
    });
    return;
  }

  if (mobileMatch) {
    await interaction.reply({ content: `\`${entry.cookie}\``, ephemeral: true });
  } else {
    await interaction.reply({ content: `\`\`\`\n${entry.cookie}\n\`\`\``, ephemeral: true });
  }
}

// ─── Command ───────────────────────────────────────────────────────────────

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

  // ── Step 1: Soft-refresh → obtain new session token ─────────────────────
  let newCookie: string | null = null;
  let refreshDebug = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await refreshCookie(oldCookie);
    refreshDebug = r.debug;
    if (r.newCookie) { newCookie = r.newCookie; break; }
    if (r.status === 'COOKIE_EXPIRED') break;
  }

  if (!newCookie) {
    await interaction.editReply({
      embeds: [errorEmbed('Re-session Failed', `Cookie may be expired or the refresh endpoint rejected it.\n\`\`\`\n${refreshDebug}\n\`\`\``)],
    });
    return;
  }

  // ── Step 2: Kill old sessions using the OLD cookie ───────────────────────
  //
  // After a soft-refresh, the old token is often already invalidated by Roblox.
  // A COOKIE_EXPIRED (401) response on the kill step means the old cookie is
  // already dead — that is the desired outcome, not a failure.
  //
  const killResult = await killSessions(oldCookie);
  const killOk = killResult.status === 'SUCCESS' || killResult.status === 'COOKIE_EXPIRED';

  if (killOk) {
    await interaction.editReply({
      embeds: [successEmbed('Cookie Re-Sessioned', 'Old sessions have been cleared. Use the buttons below to copy your new cookie.')],
      components: [storeAndBuildRow(newCookie)],
    });
  } else {
    // Real failure (network error, unexpected status) — still give the new cookie but warn
    await interaction.editReply({
      embeds: [
        warnEmbed('Cookie Refreshed — Sessions May Still Be Active',
          `Got a new cookie but couldn't confirm old sessions were killed.\nKill status: \`${killResult.status}\`\n\nThe new cookie is still valid — use the buttons to copy it.`),
      ],
      components: [storeAndBuildRow(newCookie)],
    });
  }
}

export const rcookieCommand: Command = { data, execute, handleButton: handleButtonInteraction };
