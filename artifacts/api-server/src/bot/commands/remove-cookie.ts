import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const removeCookieCommand = new SlashCommandBuilder()
  .setName("remove-cookie")
  .setDescription("Remove a saved cookie from the bot")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("label")
      .setDescription("The label of the cookie to remove")
      .setRequired(true),
  );

export async function handleRemoveCookie(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const label = interaction.options.getString("label", true).trim();

  const [deleted] = await db
    .delete(cookiesTable)
    .where(eq(cookiesTable.label, label))
    .returning({ id: cookiesTable.id });

  if (!deleted) {
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

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle("🗑️ Cookie Removed")
        .setDescription(`Cookie **${label}** has been permanently deleted.`)
        .setTimestamp(),
    ],
  });
}
