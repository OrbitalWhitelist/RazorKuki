# Razor Tools

A Discord bot for managing Roblox `.ROBLOSECURITY` cookies — save, refresh, check, list, and remove cookies via slash commands. Runs as a background process inside the API server.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Discord bot (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required Secrets / Env Vars

| Key | Where to get it |
|---|---|
| `DISCORD_BOT_TOKEN` | Discord Developer Portal → Your App → Bot → Token |
| `GUILD_ID` | Right-click your Discord server → Copy Server ID |
| `DATABASE_URL` | Replit-managed (auto-provisioned) |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Bot: discord.js v14 (slash commands, global registration)
- API: Express 5 (also serves the UptimeRobot health ping)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle) — discord.js is externalized

## Where things live

- `artifacts/api-server/src/bot/index.ts` — bot init, security guard, command routing
- `artifacts/api-server/src/bot/roblox.ts` — `refreshCookie`, `checkCookie`, `maskCookie`
- `artifacts/api-server/src/bot/commands/` — one file per slash command
- `artifacts/api-server/src/routes/health.ts` — `/api/healthz` (used by UptimeRobot)
- `lib/db/src/schema/cookies.ts` — `roblox_cookies` table

## Bot Commands

| Command | What it does |
|---|---|
| `/add-cookie` | Save a new cookie with a label |
| `/refresh-cookie` | Renew a cookie via Roblox's reauthenticate endpoint |
| `/check-cookie` | Verify a cookie is still valid (shows Roblox username) |
| `/list-cookies` | List all cookies with masked values and statuses |
| `/remove-cookie` | Permanently delete a cookie |
| `/test` | Health check — DB, Roblox API, bot & API latency |

All replies are ephemeral (only visible to the user who ran the command).

## Security Model

- **Guild whitelist** — every interaction is checked against `GUILD_ID` in the code. Interactions from DMs, other servers, or test servers are blocked and logged.
- **Developer Portal** — set `PUBLIC BOT = OFF` to prevent anyone from inviting the bot to other servers (see Gotchas).
- **Ephemeral replies** — all cookie data is only visible to the sender, never in public channels.
- **Input validation** — all inputs go through Zod schemas server-side; no client trust.
- **Masked display** — cookies are never shown in full; only first 15 + last 6 characters.

## UptimeRobot Setup (24/7 hosting)

1. Deploy this Replit project (click Deploy in the top bar) to get a permanent `*.replit.app` domain.
2. Go to [UptimeRobot](https://uptimerobot.com) → Add New Monitor:
   - Type: **HTTP(s)**
   - URL: `https://YOUR-DOMAIN.replit.app/api/healthz`
   - Interval: **5 minutes**
3. UptimeRobot will ping the health endpoint every 5 minutes, keeping the bot alive 24/7.

## Architecture decisions

- The Discord bot runs in the same process as the Express server to keep the deployment footprint small (one Replit service instead of two).
- Slash commands are registered **globally** (not per-guild) to avoid the `applications.commands` OAuth scope requirement. Security is enforced entirely in the interaction handler via guild whitelist.
- `discord.js` is externalized from the esbuild bundle — it's a pure-JS ESM package that resolves fine from `node_modules` at runtime, and externalizing avoids any bundling edge cases.

## Gotchas

- **Set PUBLIC BOT = OFF in Discord Developer Portal** → Applications → Your App → Installation → toggle off "Public Bot". This prevents others from inviting the bot to their servers (the code-level guild whitelist is a second layer, but turning off public installs is the primary gate).
- discord.js must be in `external[]` in `build.mjs`; do not remove it.
- After any `lib/db` schema change, run `pnpm --filter @workspace/db run push` before restarting.
- Global slash commands can take **up to 1 hour** to propagate in Discord after registration. Guild-specific commands appear instantly but require the `applications.commands` OAuth scope on re-invite.

## User preferences

_Populate as you build._
