import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db, cookiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { refreshCookie } from "../roblox";

export const refreshCookieCommand = new SlashCommandBuilder()
  .setName("rcookie")
  .setDescription("Re-session a cookie!")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("label")
      .setDescription("The label of the cookie to re-session")
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
    await interaction.editReply(`❌ No cookie found with label **${label}**.`);
    return;
  }

  // Try up to 2 times
  let newCookie: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await refreshCookie(row.cookieValue);
    if (result.newCookie) {
      newCookie = result.newCookie;
      break;
    }
  }

  if (!newCookie) {
    // Mark as invalid if it was previously active
    if (row.status === "active") {
      await db
        .update(cookiesTable)
        .set({ status: "invalid" })
        .where(eq(cookiesTable.id, row.id));
    }
    await interaction.editReply("Failed");
    return;
  }

  // Save the refreshed cookie to the database
  await db
    .update(cookiesTable)
    .set({
      cookieValue: newCookie,
      status: "active",
      lastRefreshed: new Date(),
    })
    .where(eq(cookiesTable.id, row.id));

  // Success — send the header, then two copy-friendly versions
  await interaction.editReply(
    `✅ **Cookie re-sessioned!** Label: \`${label}\``,
  );

  // Mobile copy — inline backtick, easy to long-press select on phone
  await interaction.followUp({
    content: `📱 **Mobile copy:**\n\`${newCookie}\``,
    ephemeral: true,
  });

  // PC copy — code block, easy to click-copy on desktop
  await interaction.followUp({
    content: `💻 **PC copy:**\n\`\`\`\n${newCookie}\n\`\`\``,
    ephemeral: true,
  });
}
