import { EmbedBuilder } from 'discord.js';
import type { ValidateResult } from './roblox';

// ─── Brand colours ─────────────────────────────────────────────────────────
export const COLOR = {
  green:  0x57F287,
  red:    0xED4245,
  yellow: 0xFEE75C,
  blue:   0x5865F2,
  blurple: 0x5865F2,
} as const;

const FOOTER = { text: '⚔ Razor Tools' };

// ─── Account age formatter ─────────────────────────────────────────────────
export function formatAccountAge(days: number): string {
  const years  = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const d      = days % 30;
  const parts: string[] = [];
  if (years  > 0) parts.push(`${years}yr`);
  if (months > 0) parts.push(`${months}mo`);
  if (d      > 0) parts.push(`${d}d`);
  return `${days}d — ${parts.join(' ')}`;
}

// ─── Account embed ─────────────────────────────────────────────────────────

/**
 * Builds a rich account info embed from a ValidateResult.
 * Fields: Robux | Age | Premium  (Headless/Korblox removed)
 */
export function buildAccountEmbed(r: ValidateResult): EmbedBuilder {
  const ageStr     = r.accountAgeDays != null ? formatAccountAge(r.accountAgeDays) : '?';
  const robuxStr   = r.robux    != null ? `${r.robux.toLocaleString()}` : '?';
  const premiumStr = r.isPremium == null ? '?' : r.isPremium ? 'Yes ✓' : 'No';

  return new EmbedBuilder()
    .setColor(COLOR.blue)
    .setTitle(`${r.username ?? 'Unknown'} (${r.displayName ?? '?'})`)
    .setDescription(`ID: \`${r.userId ?? '?'}\``)
    .addFields(
      { name: 'Robux',   value: robuxStr,   inline: true },
      { name: 'Age',     value: ageStr,     inline: true },
      { name: 'Premium', value: premiumStr, inline: true },
    )
    .setFooter(FOOTER)
    .setTimestamp();
}

// ─── Status embeds ─────────────────────────────────────────────────────────

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(COLOR.green).setTitle(`✅ ${title}`).setFooter(FOOTER).setTimestamp();
  if (description) e.setDescription(description);
  return e;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(COLOR.red).setTitle(`❌ ${title}`).setFooter(FOOTER).setTimestamp();
  if (description) e.setDescription(description);
  return e;
}

export function warnEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(COLOR.yellow).setTitle(`⚠️ ${title}`).setFooter(FOOTER).setTimestamp();
  if (description) e.setDescription(description);
  return e;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder().setColor(COLOR.blurple).setTitle(title).setFooter(FOOTER).setTimestamp();
  if (description) e.setDescription(description);
  return e;
}
