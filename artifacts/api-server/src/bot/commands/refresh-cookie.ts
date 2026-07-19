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

  const debugBlock = result?.debug
    ? `\n\n**🔍 Debug log:**\n\`\`\`\n${result.debug}\n\`\`\``
    : "";

  if (!result || !result.newCookie) {
    await interaction.editReply(
      `❌ **Refresh failed** (status: \`${result?.status ?? "unknown"}\`)${debugBlock}`,
    );
    return;
  }

  // Single message: status + debug + old cookie + new cookie
  await interaction.editReply(
    [
      "✅ **Cookie re-sessioned!**",
      "",
      `**📥 Old cookie (you pasted):**`,
      `\`\`\``,
      cookie,
      `\`\`\``,
      "",
      `**📤 New cookie:**`,
      `\`${result.newCookie}\``,
      "",
      `**💻 New cookie (copy-friendly):**`,
      `\`\`\``,
      result.newCookie,
      `\`\`\``,
      debugBlock,
    ].join("\n"),
  );
}
