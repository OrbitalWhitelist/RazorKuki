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

// ─── Cookie fingerprint helper (last 10 chars of bare token) ──────────────

function fp(cookie: string): string {
  const bare = cookie.includes('|_CAEQ') ? cookie.slice(cookie.lastIndexOf('|_') + 2) : cookie;
  return `…${bare.slice(-10)} (${bare.length}c)`;
}

function step(n: number, total: number, label: string) {
  console.log(`\n[RCOOKIE] ─── Step ${n}/${total}: ${label} ───`);
}
function info(msg: string) {
  console.log(`[RCOOKIE]   ${msg}`);
}
function divider() {
  console.log('[RCOOKIE] ' + '─'.repeat(50));
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

  console.log('\n[RCOOKIE] ══════════════════════════════════════════════════');
  console.log('[RCOOKIE]  /rcookie invoked');
  info(`Input cookie  : ${fp(oldCookie)}`);
  console.log('[RCOOKIE] ══════════════════════════════════════════════════');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Soft-refresh the OLD cookie → get a NEW session token
  //   We use the OLD cookie to authenticate the refresh request.
  //   Roblox returns a new .ROBLOSECURITY value in Set-Cookie.
  //   The old cookie may or may not be immediately invalidated by Roblox.
  // ─────────────────────────────────────────────────────────────────────────
  step(1, 3, 'Soft Refresh (POST /v2/session/refresh)');
  info(`Using cookie  : ${fp(oldCookie)}  ← OLD cookie`);

  let newCookie: string | null = null;
  let refreshDebug = '';
  const t1 = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) info(`Retrying (attempt ${attempt})…`);
    const r = await refreshCookie(oldCookie);
    refreshDebug = r.debug;
    if (r.newCookie) { newCookie = r.newCookie; break; }
    if (r.status === 'COOKIE_EXPIRED') { info('Cookie expired — aborting'); break; }
  }

  info(`Duration      : ${Date.now() - t1}ms`);

  if (!newCookie) {
    info('✗ FAILED — no new cookie returned');
    divider();
    await interaction.editReply({
      embeds: [errorEmbed('Re-session Failed', `Cookie may be expired or the refresh endpoint rejected it.\n\`\`\`\n${refreshDebug}\n\`\`\``)],
    });
    return;
  }

  info(`✓ New cookie  : ${fp(newCookie)}  ← NEW (different from old)`);
  info(`  Old cookie  : ${fp(oldCookie)}  ← will be killed in step 2`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Kill all sessions on the OLD cookie
  //   We EXPLICITLY use the OLD cookie here — not the new one.
  //   If Roblox returns 401 (COOKIE_EXPIRED), the old cookie is already dead
  //   (invalidated by the refresh in step 1). That is the desired outcome.
  //   We only warn on unexpected errors (5xx, network, etc.).
  // ─────────────────────────────────────────────────────────────────────────
  step(2, 3, 'Kill Old Sessions (POST /v2/logoutfromallsessionsandreauthenticate)');
  info(`Using cookie  : ${fp(oldCookie)}  ← OLD cookie (NOT the new one)`);
  info(`New cookie    : ${fp(newCookie)}  ← will NOT be touched`);

  const t2 = Date.now();
  const killResult = await killSessions(oldCookie);
  info(`Duration      : ${Date.now() - t2}ms`);
  info(`Kill status   : ${killResult.status}`);

  // 401 = old cookie already dead (invalidated by the refresh) → success
  // 200 = explicit kill confirmed → success
  // anything else → partial failure but new cookie is still valid
  const killOk = killResult.status === 'SUCCESS' || killResult.status === 'COOKIE_EXPIRED';

  if (killResult.status === 'COOKIE_EXPIRED') {
    info('✓ Old cookie already dead (invalidated by refresh) — sessions cleared');
  } else if (killResult.status === 'SUCCESS') {
    info('✓ Sessions killed explicitly via logout endpoint');
  } else {
    info(`⚠ Unexpected kill result — new cookie still valid, delivering anyway`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Deliver new cookie to user
  // ─────────────────────────────────────────────────────────────────────────
  step(3, 3, 'Deliver New Cookie');
  info(`Delivering    : ${fp(newCookie)}`);
  console.log('[RCOOKIE] ══════════════════════════════════════════════════\n');

  if (killOk) {
    await interaction.editReply({
      embeds: [successEmbed('Cookie Re-Sessioned', 'Old sessions cleared. Use the buttons below to copy your new cookie.')],
      components: [storeAndBuildRow(newCookie)],
    });
  } else {
    await interaction.editReply({
      embeds: [
        warnEmbed('Cookie Refreshed — Sessions May Still Be Active',
          `Got a new cookie but couldn't confirm old sessions were killed.\nKill status: \`${killResult.status}\`\n\nNew cookie is still valid — use the buttons to copy it.`),
      ],
      components: [storeAndBuildRow(newCookie)],
    });
  }
}

export const rcookieCommand: Command = { data, execute, handleButton: handleButtonInteraction };
