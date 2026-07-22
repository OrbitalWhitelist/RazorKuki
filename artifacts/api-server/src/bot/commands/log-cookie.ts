import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { validateCookie } from '../roblox';
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

async function fetchParentalControls(cookie: string): Promise<{ hasParent: boolean; canAddParent: boolean }> {
  try {
    const resp = await fetch('https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return {
        hasParent: (data.parents && data.parents.length > 0) || false,
        canAddParent: data.canAddParent || false,
      };
    }
  } catch {}
  return { hasParent: false, canAddParent: false };
}

async function fetchCountry(cookie: string): Promise<string> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return data.value?.countryName || 'Unknown';
    }
  } catch {}
  return 'Unknown';
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
  try {
    await interaction.deferReply({ ephemeral: true });

    const cookie = interaction.options.getString('cookie', true).trim();
    const timestamp = new Date().toLocaleString();
    const footerData = {
      text: `${interaction.user.username} | ${timestamp}`,
      iconURL: interaction.user.displayAvatarURL(),
    };

    const result = await validateCookie(cookie);

    if (!result.valid) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Invalid Cookie .ᐟ')
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **Error Occurred**\n` +
          `────\n` +
          `⭑ The provided cookie is not valid or has expired.\n` +
          `⭑ \`\`\`\n${result.debug}\n\`\`\``
        )
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const { userId, username, displayName } = result;
    const [tx, parental, country] = await Promise.all([
      fetchTransactionTotals(cookie, String(userId)),
      fetchParentalControls(cookie),
      fetchCountry(cookie),
    ]);

    const parentStatus = parental.hasParent ? '✅ Parent linked' : '❌ No parent linked';

    const embed = new EmbedBuilder()
      .setTitle('𖣐 Cookie Valid .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **User Information**\n` +
        `────\n` +
        `⭑ **Username:** ${username}\n` +
        `⭑ **Display Name:** ${displayName || username}\n` +
        `⭑ **User ID:** ${userId}\n` +
        `⭑ **Country:** ${country}\n` +
        `────\n` +
        `✧ **Account Details**\n` +
        `────\n` +
        `⭑ **Parental Controls:** ${parentStatus}\n` +
        `────\n` +
        `✧ **Robux Summary (Year)**\n` +
        `────\n` +
        `⭑ **Incoming:** ${tx.incoming.toLocaleString()} ₽\n` +
        `⭑ **Outgoing:** ${tx.outgoing.toLocaleString()} ₽\n` +
        `────\n` +
        `⭑ Your credentials were not logged.`
      )
      .setFooter(footerData);

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Error .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Unexpected Error**\n` +
        `────\n` +
        `⭑ ${error.message || 'Something went wrong.'}`
      )
      .setFooter({ text: `${interaction.user.username} | ${new Date().toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.editReply({ embeds: [embed] });
  }
}

export const loginCommand: Command = { data, execute };