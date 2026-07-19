import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkCookie } from "../roblox";

export const checkCookieCommand = new SlashCommandBuilder()
  .setName("check-cookie")
  .setDescription("Check whether a saved cookie is still valid")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("label")
      .setDescription("The label of the cookie to check")
      .setRequired(true),
  );

export async function handleCheckCookie(
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

  const result = await checkCookie(row.cookieValue);

  // Update status and lastChecked in DB
  await db
    .update(cookiesTable)
    .set({
      status: result.valid ? "active" : "invalid",
      lastChecked: new Date(),
    })
    .where(eq(cookiesTable.id, row.id));

  if (result.valid) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle("✅ Cookie Valid")
          .addFields(
            { name: "Label", value: label, inline: true },
            {
              name: "Roblox Account",
              value: result.username ?? "Unknown",
              inline: true,
            },
            {
              name: "User ID",
              value: result.userId?.toString() ?? "Unknown",
              inline: true,
            },
          )
          .setTimestamp(),
      ],
    });
  } else {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Cookie Invalid")
          .addFields({ name: "Label", value: label, inline: true })
          .setDescription(
            "This cookie is no longer valid. Try `/refresh-cookie` to renew it, or `/add-cookie` to replace it.",
          )
          .setTimestamp(),
      ],
    });
  }
}
