import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { validateCookie, formatAccountCard } from '../roblox';

export const logCookieCommand = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Check a Roblox cookie and display account info')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('Full .ROBLOSECURITY cookie or bare CAEQ... value').setRequired(true),
  );

export async function handleLogCookie(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString('cookie', true).trim();
  const result = await validateCookie(cookie);

  if (result.valid) {
    await interaction.editReply(`✅ **Cookie Valid**\n\n${formatAccountCard(result)}`);
  } else {
    await interaction.editReply(`❌ **Cookie Invalid or Expired**\n\`\`\`\n${result.debug}\n\`\`\``);
  }
}
