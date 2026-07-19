import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { refreshCookie, maskCookie } from "../roblox";

export const refreshCookieCommand = new SlashCommandBuilder()
  .setName("refresh-cookie")
  .setDescription("Refresh a saved Roblox cookie to get a new valid one")
  .addStringOption((opt) =>
    opt
      .setName("label")
      .setDescription("The label of the cookie to refresh")
      .setRequired(true),
  );

export async function handleRefreshCookie(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const label = interaction.options.getString("label", true).trim();

  const [row] = await db
    .select()
    .from(cookiesTable)
    .where(eq(cookiesTable.label, label));

  if (!row) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Not Found")
          .setDescription(`No cookie found with the label **${label}**.`),
      ],
    });
    return;
  }

  const { newCookie, status } = await refreshCookie(row.cookieValue);

  if (newCookie) {
    await db
      .update(cookiesTable)
      .set({
        cookieValue: newCookie,
        status: "active",
        lastRefreshed: new Date(),
      })
      .where(eq(cookiesTable.id, row.id));

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle("🔄 Cookie Refreshed")
          .addFields(
            { name: "Label", value: label, inline: true },
            { name: "Status", value: status, inline: true },
            {
              name: "New Cookie (masked)",
              value: `\`${maskCookie(newCookie)}\``,
            },
          )
          .setTimestamp(),
      ],
    });
  } else {
    // Refresh failed — mark as invalid if it was active
    if (row.status === "active") {
      await db
        .update(cookiesTable)
        .set({ status: "invalid" })
        .where(eq(cookiesTable.id, row.id));
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Refresh Failed")
          .addFields(
            { name: "Label", value: label, inline: true },
            { name: "Error", value: status, inline: true },
          )
          .setDescription(
            "The cookie could not be refreshed. It may have already expired or been invalidated.",
          )
          .setTimestamp(),
      ],
    });
  }
}
