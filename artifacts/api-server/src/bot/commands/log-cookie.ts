import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { validateCookie } from '../roblox';
import { buildAccountEmbed, successEmbed, errorEmbed } from '../ui';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Validate a Roblox cookie and display account info')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie')
      .setDescription('Full .ROBLOSECURITY cookie or bare CAEQ… value')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString('cookie', true).trim();
  const result = await validateCookie(cookie);

  if (result.valid) {
    await interaction.editReply({
      embeds: [
        successEmbed('Cookie Valid'),
        buildAccountEmbed(result),
      ],
    });
  } else {
    await interaction.editReply({
      embeds: [errorEmbed('Cookie Invalid or Expired', `\`\`\`\n${result.debug}\n\`\`\``)],
    });
  }
}

export const logCommand: Command = { data, execute };
