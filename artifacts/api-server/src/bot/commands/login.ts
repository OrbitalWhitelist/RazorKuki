import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildAccountEmbed, buildInvalidCookieEmbed, buildIpLimitEmbed, buildErrorEmbed } from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('login')
  .setDescription('Validating & Checking')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName('cookie')
      .setDescription('Insert The Cookies!')
      .setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const validation = await Roblox.validateCookie(rawCookie);
    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const userId = validation.userId!;
    const age = await Roblox.getUserAge(userId);
    const robux = await Roblox.fetchRobux(rawCookie, String(userId));
    const summary = await Roblox.fetchTransactionTotals(rawCookie, String(userId));
    const country = await Roblox.fetchCountry(rawCookie);
    const email = await Roblox.fetchEmailInfo(rawCookie);
    const parental = await Roblox.fetchParentalControls(rawCookie);
    const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

    let emailStatus = 'No email found';
    if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
    else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;

    const parentStatus = parental.hasParent ? '✅ Parent linked' : '❌ No parent linked';

    const embed = buildAccountEmbed(
      validation.username!,
      validation.displayName || null,
      userId,
      age,
      robux,
      summary,
      country,
      emailStatus,
      parentStatus,
      thumb
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    logger.error({ err }, 'Login command error');
    await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')] });
  }
}

export const loginCommand: Command = { data, execute };