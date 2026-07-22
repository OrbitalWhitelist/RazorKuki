import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { validateCookie } from '../roblox';
import { buildAccountEmbed, successEmbed, errorEmbed } from '../ui';
import type { Command } from './types';

async function fetchTransactionTotals(cookie: string, userId: string): Promise<{ incoming: number; outgoing: number }> {
  try {
    const url = `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?usedTypes=2228224&timeFrame=Year&transactionType=summary`;
    const resp = await fetch(url, {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return {
        incoming: data.incomingRobuxTotal || 0,
        outgoing: data.outgoingRobuxTotal || 0,
      };
    }
  } catch {}
  return { incoming: 0, outgoing: 0 };
}

const data = new SlashCommandBuilder()
  .setName('login')
  .setDescription('Validating & Checking')
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

  if (!result.valid) {
    await interaction.editReply({
      embeds: [errorEmbed('Cookie Invalid or Expired', `\`\`\`\n${result.debug}\n\`\`\``)],
    });
    return;
  }

  const { userId, username, displayName } = result;
  const tx = await fetchTransactionTotals(cookie, String(userId));

  const embed = new EmbedBuilder()
    .setTitle('𖣐 Cookie Valid .ᐟ')
    .setColor('#FFFFFF')
    .setDescription(
      `✧ **User Information**\n` +
      `────\n` +
      `⭑ **Username:** ${username}\n` +
      `⭑ **Display Name:** ${displayName || username}\n` +
      `⭑ **User ID:** ${userId}\n` +
      `────\n` +
      `✧ **Robux Summary (Year)**\n` +
      `────\n` +
      `⭑ **Incoming:** ${tx.incoming.toLocaleString()} ₽\n` +
      `⭑ **Outgoing:** ${tx.outgoing.toLocaleString()} ₽\n` +
      `────\n` +
      `⭑ Your credentials were not logged.`
    )
    .setFooter({
      text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  await interaction.editReply({ embeds: [embed] });
}

export const logCommand: Command = { data, execute };