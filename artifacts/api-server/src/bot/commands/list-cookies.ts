import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { maskCookie } from "../roblox";

export const listCookiesCommand = new SlashCommandBuilder()
  .setName("list-cookies")
  .setDescription("List all saved Roblox cookies")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const STATUS_EMOJI: Record<string, string> = {
  active: "🟢",
  invalid: "🔴",
  expired: "🟡",
};

export async function handleListCookies(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const rows = await db
    .select()
    .from(cookiesTable)
    .orderBy(cookiesTable.createdAt);

  if (rows.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🍪 Razor Tools — Cookie Manager")
          .setDescription(
            "No cookies saved yet. Use `/add-cookie` to add one.",
          ),
      ],
    });
    return;
  }

  const fields = rows.map((row) => {
    const emoji = STATUS_EMOJI[row.status] ?? "⚪";
    const lastRefreshed = row.lastRefreshed
      ? `<t:${Math.floor(row.lastRefreshed.getTime() / 1000)}:R>`
      : "Never";
    const lastChecked = row.lastChecked
      ? `<t:${Math.floor(row.lastChecked.getTime() / 1000)}:R>`
      : "Never";

    return {
      name: `${emoji} ${row.label}`,
      value: [
        `**Cookie:** \`${maskCookie(row.cookieValue)}\``,
        `**Status:** ${row.status}`,
        `**Last Refreshed:** ${lastRefreshed}`,
        `**Last Checked:** ${lastChecked}`,
        `**Added by:** <@${row.addedBy}>`,
      ].join("\n"),
    };
  });

  // Discord embeds allow up to 25 fields
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🍪 Razor Tools — Cookie Manager")
    .setDescription(`**${rows.length}** cookie(s) saved`)
    .addFields(fields.slice(0, 25))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
