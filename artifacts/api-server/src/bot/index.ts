import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type Interaction,
} from "discord.js";
import { logger } from "../lib/logger";
import { addCookieCommand, handleAddCookie } from "./commands/add-cookie";
import {
  refreshCookieCommand,
  handleRefreshCookie,
} from "./commands/refresh-cookie";
import {
  listCookiesCommand,
  handleListCookies,
} from "./commands/list-cookies";
import {
  checkCookieCommand,
  handleCheckCookie,
} from "./commands/check-cookie";
import {
  removeCookieCommand,
  handleRemoveCookie,
} from "./commands/remove-cookie";
import { testCommand, createTestHandler } from "./commands/test";

const COMMANDS = [
  addCookieCommand,
  refreshCookieCommand,
  listCookiesCommand,
  checkCookieCommand,
  removeCookieCommand,
  testCommand,
];

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];

  // GUILD_ID is the ONLY server this bot is allowed to operate in
  const allowedGuildId = process.env["GUILD_ID"];

  if (!token) {
    logger.warn(
      "DISCORD_BOT_TOKEN is not set — Razor Tools bot will not start",
    );
    return;
  }

  if (!allowedGuildId) {
    logger.error("GUILD_ID is not set — refusing to start without a guild whitelist");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    // Disable DM channels entirely at the gateway level
    allowedMentions: { parse: [] },
  });

  const handleTest = createTestHandler(client);

  // Use clientReady to suppress the v14 deprecation warning
  client.once("clientReady", async (c) => {
    logger.info({ tag: c.user.tag }, "⚔️  Razor Tools bot is online");

    // Register as GLOBAL commands — no guild scope required so no "Missing Access" error.
    // They appear in every server the bot is in, but the guild whitelist below
    // ensures they ONLY WORK in the allowed server.
    const rest = new REST({ version: "10" }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(c.application.id), {
        body: COMMANDS.map((cmd) => cmd.toJSON()),
      });
      logger.info(
        { count: COMMANDS.length },
        "Global slash commands registered — may take up to 1 hour to appear in Discord",
      );
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ── SECURITY LAYER ────────────────────────────────────────────────────────
    // 1. Guild whitelist — block DMs, other servers, test servers.
    if (interaction.guildId !== allowedGuildId) {
      await interaction.reply({
        content:
          "⛔ Razor Tools is a private bot and is not authorized for use here.",
        ephemeral: true,
      });
      logger.warn(
        {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          command: interaction.commandName,
        },
        "Blocked unauthorized guild interaction",
      );
      return;
    }

    // 2. Owner whitelist — if OWNER_IDS is set, only those user IDs may run commands.
    //    Set OWNER_IDS as a comma-separated list of Discord user IDs, e.g. "123456,789012"
    const ownerIds = (process.env["OWNER_IDS"] ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ownerIds.length > 0 && !ownerIds.includes(interaction.user.id)) {
      await interaction.reply({
        content: "⛔ You are not authorized to use Razor Tools.",
        ephemeral: true,
      });
      logger.warn(
        { userId: interaction.user.id, command: interaction.commandName },
        "Blocked unauthorized user interaction",
      );
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      switch (interaction.commandName) {
        case "add-cookie":
          await handleAddCookie(interaction);
          break;
        case "refresh-cookie":
          await handleRefreshCookie(interaction);
          break;
        case "list-cookies":
          await handleListCookies(interaction);
          break;
        case "check-cookie":
          await handleCheckCookie(interaction);
          break;
        case "remove-cookie":
          await handleRemoveCookie(interaction);
          break;
        case "test":
          await handleTest(interaction);
          break;
        default:
          logger.warn(
            { command: interaction.commandName },
            "Unknown command received",
          );
      }
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Command error");
      const msg = {
        content: "❌ An unexpected error occurred.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  await client.login(token);
}
