import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const addCookieCommand = new SlashCommandBuilder()
  .setName("add-cookie")
  .setDescription("Save a new Roblox cookie")
  .addStringOption((opt) =>
    opt
      .setName("label")
      .setDescription("A short name for this cookie (e.g. main-account)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("cookie")
      .setDescription("The .ROBLOSECURITY cookie value")
      .setRequired(true),
  );

export async function handleAddCookie(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const label = interaction.options.getString("label", true).trim();
  const cookie = interaction.options.getString("cookie", true).trim();

  // Check for duplicate label
  const [existing] = await db
    .select({ id: cookiesTable.id })
    .from(cookiesTable)
    .where(eq(cookiesTable.label, label));

  if (existing) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Label Already Exists")
          .setDescription(
            `A cookie with the label **${label}** already exists. Use \`/remove-cookie\` first, or choose a different label.`,
          ),
      ],
    });
    return;
  }

  await db.insert(cookiesTable).values({
    label,
    cookieValue: cookie,
    status: "active",
    addedBy: interaction.user.id,
  });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("✅ Cookie Saved")
        .addFields(
          { name: "Label", value: label, inline: true },
          { name: "Added By", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setFooter({ text: "Use /check-cookie to verify it is valid." })
        .setTimestamp(),
    ],
  });
}
