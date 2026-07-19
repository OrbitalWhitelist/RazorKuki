import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { refreshCookie } from "../roblox";

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

  // Try up to 2 times
  let newCookie: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await refreshCookie(cookie);
    if (result.newCookie) {
      newCookie = result.newCookie;
      break;
    }
  }

  if (!newCookie) {
    await interaction.editReply("Failed");
    return;
  }

  // Success — confirmation, then two copy-friendly versions
  await interaction.editReply("✅ **Cookie re-sessioned!**");

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
