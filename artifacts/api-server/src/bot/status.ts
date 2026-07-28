export const botState = {
  online: false,
  tag: null as string | null,
  readyAt: null as Date | null,
  guildId: process.env['GUILD_ID'] ?? null,
};
