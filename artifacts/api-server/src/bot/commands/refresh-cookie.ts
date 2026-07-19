import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { refreshCookie, type RefreshResult } from "../roblox";

export const refreshCookieCommand = new SlashCommandBuilder()
  .setName("rcookie")
  .setDescription("Re-session a cookie!")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("cookie")
      .setDescription("The full .ROBLOSECURITY cookie to re-session")
      .setRequired(true),
  );

export async function handleRefreshCookie(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString("cookie", true).trim();

  let result: RefreshResult | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    result = await refreshCookie(cookie);
    if (result.newCookie) break;
  }

  if (!result || !result.newCookie) {
    await interaction.editReply("❌ **Refresh failed**");
    for (const line of result?.debug ?? []) {
      await interaction.followUp({ content: line, ephemeral: true });
    }
    return;
  }

  // Success — confirmation + debug logs + two copy-friendly versions
  await interaction.editReply("✅ **Cookie re-sessioned!**");

  for (const line of result.debug) {
    await interaction.followUp({ content: line, ephemeral: true });
  }

  await interaction.followUp({
    content: `📱 **Mobile copy:**\n\`${result.newCookie}\``,
    ephemeral: true,
  });

  await interaction.followUp({
    content: `💻 **PC copy:**\n\`\`\`\n${result.newCookie}\n\`\`\``,
    ephemeral: true,
  });
}
