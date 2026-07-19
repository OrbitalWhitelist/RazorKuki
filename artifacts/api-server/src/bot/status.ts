/**
 * In-memory bot connection state, updated by the Discord client lifecycle events.
 * Exposed via /api/bot-status so the frontend can show live status.
 */
export const botState = {
  online: false,
  tag: null as string | null,
  readyAt: null as Date | null,
  guildId: process.env["GUILD_ID"] ?? null,
};
