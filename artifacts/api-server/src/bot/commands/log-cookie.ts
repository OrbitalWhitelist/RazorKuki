import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { validateCookie } from '../roblox';
import { buildAccountCard, successHeader, errorHeader } from '../ui';
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
    await interaction.editReply(
      successHeader('Cookie Valid') + '\n' + buildAccountCard(result),
    );
  } else {
    await interaction.editReply(
      errorHeader('Cookie Invalid or Expired', result.debug),
    );
  }
}

export const logCommand: Command = { data, execute };
