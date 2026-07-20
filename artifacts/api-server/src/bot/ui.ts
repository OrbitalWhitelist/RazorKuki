import type { ValidateResult } from './roblox';

// ─── ANSI escape helpers ───────────────────────────────────────────────────
const R  = '\x1B[0m';
const B  = '\x1B[1m';
const DM = '\x1B[2m';

const cRed    = '\x1B[31m';
const cGreen  = '\x1B[32m';
const cYellow = '\x1B[33m';
const cBlue   = '\x1B[34m';
const cCyan   = '\x1B[36m';
const cWhite  = '\x1B[37m';

const boldCyan   = (s: string) => `${B}${cCyan}${s}${R}`;
const boldBlue   = (s: string) => `${B}${cBlue}${s}${R}`;
const boldGreen  = (s: string) => `${B}${cGreen}${s}${R}`;
const boldRed    = (s: string) => `${B}${cRed}${s}${R}`;
const boldYellow = (s: string) => `${B}${cYellow}${s}${R}`;
const dimWhite   = (s: string) => `${DM}${cWhite}${s}${R}`;
const dimCyan    = (s: string) => `${DM}${cCyan}${s}${R}`;

/** Wraps a string in a Discord ANSI code block */
export function ansiBlock(content: string): string {
  return `\`\`\`ansi\n${content}\n\`\`\``;
}

/** Formats an account age in days to a human-readable string */
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

/** Renders a yes/no boolean with colour */
function colorBool(val: boolean | undefined): string {
  if (val == null) return dimWhite('Unknown');
  return val ? boldGreen('Yes') : dimWhite('No');
}

/** Right-pads a label to keep value columns aligned */
function lbl(s: string): string {
  return dimWhite(s.padEnd(11));
}

// ─── Divider line ─────────────────────────────────────────────────────────
const DIV = dimCyan('─────────────────────────────');

/**
 * Builds the ANSI account info card for a valid cookie result.
 */
export function buildAccountCard(r: ValidateResult): string {
  const robuxStr = r.robux != null ? boldYellow(String(r.robux)) : dimWhite('?');
  const ageStr   = r.accountAgeDays != null
    ? boldBlue(formatAccountAge(r.accountAgeDays))
    : dimWhite('?');

  const lines = [
    boldCyan('⚔  RAZOR TOOLS') + '  ' + dimWhite('— Account Info'),
    DIV,
    boldBlue(r.username ?? '?') + '  ' + dimWhite(`(${r.displayName ?? '?'})`),
    dimWhite('ID  ') + dimWhite(String(r.userId ?? '?')),
    '',
    lbl('Robux')    + robuxStr,
    lbl('Age')      + ageStr,
    lbl('Premium')  + colorBool(r.isPremium),
    lbl('Headless') + colorBool(r.hasHeadless),
    lbl('Korblox')  + colorBool(r.hasKorblox),
    DIV,
  ];

  return ansiBlock(lines.join('\n'));
}

/**
 * Builds a success header line (green tick, bold title, optional subtitle).
 */
export function successHeader(title: string, subtitle?: string): string {
  const sub = subtitle ? `\n${dimWhite(subtitle)}` : '';
  return ansiBlock(boldGreen(`✓  ${title}`) + sub);
}

/**
 * Builds an error header line (red cross, bold title, optional detail).
 */
export function errorHeader(title: string, detail?: string): string {
  const det = detail ? `\n${dimWhite(detail)}` : '';
  return ansiBlock(boldRed(`✗  ${title}`) + det);
}

/**
 * Builds a warning/info line (yellow, no ansi block — inline use).
 */
export function warnLine(msg: string): string {
  return ansiBlock(`${B}${cYellow}⚠  ${msg}${R}`);
}
