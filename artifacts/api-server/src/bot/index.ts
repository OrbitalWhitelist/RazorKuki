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

const COMMANDS = [
  addCookieCommand,
  refreshCookieCommand,
  listCookiesCommand,
  checkCookieCommand,
  removeCookieCommand,
];

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  const guildId = process.env["GUILD_ID"];

  if (!token) {
    logger.warn(
      "DISCORD_BOT_TOKEN is not set — Razor Tools bot will not start",
    );
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "⚔️  Razor Tools bot is online");

    // Register slash commands — guild commands update instantly, global commands take ~1h
    const rest = new REST({ version: "10" }).setToken(token);
    try {
      const route = guildId
        ? Routes.applicationGuildCommands(c.application.id, guildId)
        : Routes.applicationCommands(c.application.id);

      await rest.put(route, {
        body: COMMANDS.map((cmd) => cmd.toJSON()),
      });

      logger.info(
        { count: COMMANDS.length, guildId: guildId ?? "global" },
        "Slash commands registered",
      );
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

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
        default:
          logger.warn(
            { command: interaction.commandName },
            "Unknown command received",
          );
      }
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Command error");
      const msg = { content: "❌ An unexpected error occurred.", ephemeral: true };
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
