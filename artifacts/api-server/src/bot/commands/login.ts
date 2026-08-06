import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import {
  buildErrorEmbed,
  buildAccountEmbed,
  buildIpLimitEmbed,
  buildInvalidCookieEmbed,
} from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('login')
  .setDescription('Measuring Account Infos')
  .addStringOption((opt) =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cookie = interaction.options.getString('cookie', true);
    const validation = await Roblox.validateCookie(cookie);

    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const userId = String(validation.userId);
    const [credit, twoStep, phone, rap, ageData, ageGroup] = await Promise.all([
      Roblox.fetchCreditBalance(cookie),
      Roblox.fetchTwoStepConfig(cookie, userId),
      Roblox.fetchPhoneInfo(cookie),
      Roblox.fetchRolimonsRAP(userId),
      Roblox.getUserAge(validation.userId),
      Roblox.fetchAgeGroup(cookie),
    ]);

    const accountAgeBase = `Created ${ageData.createdYear} (${ageData.days}D)`;
    const ageString = `${accountAgeBase} - ${ageGroup}`;

    const robux = await Roblox.fetchRobux(cookie, userId);
    const summary = await Roblox.fetchTransactionTotals(cookie, userId);
    const country = await Roblox.fetchCountry(cookie);
    const email = await Roblox.fetchEmailInfo(cookie);
    const parental = await Roblox.fetchParentalControls(cookie);
    const thumb = await Roblox.fetchAvatarThumbnail(userId);

    let emailStatus = 'No email found';
    if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
    else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;

    const balance = `\`\`\`${credit.balance} ${credit.currency}\`\`\``;
    const phoneStatus = `\`\`\`${phone.hasPhone ? (phone.verified ? '✅ Verified' : '📱 Unverified') : '❌ No Phone'}\`\`\``;
    const twoStepStatus = `\`\`\`📧 Email 2FA ${twoStep.email ? '✅' : '❌'} | 🔐 Authenticator ${twoStep.authenticator ? '✅' : '❌'}\`\`\``;
    const rapValue = `\`\`\`${rap.rap !== null ? rap.rap.toLocaleString() : 'PRIVATE'}\`\`\``;
    const premiumValue = `\`\`\`${rap.premium ? '✅ Yes' : '❌ No'}\`\`\``;

    const embed = buildAccountEmbed(
      validation.username,
      validation.displayName || null,
      validation.userId,
      ageString,
      robux,
      summary,
      country,
      emailStatus,
      parental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
      thumb
    );

    embed.addFields(
      { name: '💳 Balance', value: balance, inline: true },
      { name: '📞 Phone', value: phoneStatus, inline: true },
      { name: '🔐 2FA', value: twoStepStatus, inline: false },
      { name: '📈 RAP', value: rapValue, inline: true },
      { name: '⭐ Premium', value: premiumValue, inline: true }
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    logger.error({ err }, 'Login command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const loginCommand: Command = { data, execute };