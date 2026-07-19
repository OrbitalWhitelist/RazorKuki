import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export const testCommand = new SlashCommandBuilder()
  .setName("test")
  .setDescription("Run a system health check on Razor Tools")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export function createTestHandler(client: Client) {
  return async function handleTest(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const results: { label: string; ok: boolean; detail: string }[] = [];

    // --- Bot latency ---
    const ping = client.ws.ping;
    results.push({
      label: "Bot Latency",
      ok: ping < 500,
      detail: `${ping}ms`,
    });

    // --- API round-trip latency ---
    const apiStart = Date.now();
    await interaction.editReply({ content: "⏳ Running checks…" });
    const apiPing = Date.now() - apiStart;
    results.push({
      label: "API Round-trip",
      ok: apiPing < 2000,
      detail: `${apiPing}ms`,
    });

    // --- Database connectivity ---
    try {
      const [row] = await db.execute(sql`SELECT 1 AS ok`);
      const cookieCount = await db.$count(cookiesTable);
      results.push({
        label: "Database",
        ok: true,
        detail: `Connected · ${cookieCount} cookie(s) stored`,
      });
    } catch (err) {
      results.push({
        label: "Database",
        ok: false,
        detail: String(err instanceof Error ? err.message : err),
      });
    }

    // --- Roblox API reachability ---
    try {
      const robloxStart = Date.now();
      const resp = await fetch("https://users.roblox.com/v1/users/authenticated", {
        signal: AbortSignal.timeout(5000),
      });
      const robloxMs = Date.now() - robloxStart;
      // 401 = endpoint reachable but no cookie (expected), anything else is suspicious
      const reachable = resp.status === 401 || resp.status === 200;
      results.push({
        label: "Roblox API",
        ok: reachable,
        detail: reachable
          ? `Reachable (${resp.status}) · ${robloxMs}ms`
          : `Unexpected status ${resp.status}`,
      });
    } catch (err) {
      results.push({
        label: "Roblox API",
        ok: false,
        detail: `Unreachable: ${err instanceof Error ? err.message : err}`,
      });
    }

    const allOk = results.every((r) => r.ok);

    const embed = new EmbedBuilder()
      .setColor(allOk ? 0x00ff88 : 0xff4444)
      .setTitle(allOk ? "✅ Razor Tools — All Systems Go" : "⚠️ Razor Tools — Issues Detected")
      .addFields(
        results.map((r) => ({
          name: `${r.ok ? "🟢" : "🔴"} ${r.label}`,
          value: r.detail,
          inline: false,
        })),
      )
      .setFooter({ text: `Razor Tools · Checked by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ content: "", embeds: [embed] });
  };
}
