import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { validateCookie } from "../roblox";

export const logCookieCommand = new SlashCommandBuilder()
  .setName("log")
  .setDescription("Check if a .ROBLOSECURITY cookie is valid and see who it belongs to")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("cookie")
      .setDescription("The full .ROBLOSECURITY cookie to check")
      .setRequired(true),
  );

export async function handleLogCookie(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString("cookie", true).trim();
  const result = await validateCookie(cookie);

  if (result.valid) {
    await interaction.editReply(
      [
        "✅ **Cookie is valid!**",
        "",
        `👤 **Username:** \`${result.username}\``,
        `🏷️ **Display name:** \`${result.displayName}\``,
        `🆔 **User ID:** \`${result.userId}\``,
        "",
        `**🔍 Debug log:**`,
        `\`\`\``,
        result.debug,
        `\`\`\``,
      ].join("\n"),
    );
  } else {
    await interaction.editReply(
      [
        "❌ **Cookie is invalid or expired**",
        "",
        `**🔍 Debug log:**`,
        `\`\`\``,
        result.debug,
        `\`\`\``,
      ].join("\n"),
    );
  }
}
