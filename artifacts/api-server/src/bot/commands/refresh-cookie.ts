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

const newCookieStore = new Map<string, string>();

export function buildInitialButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rc_copypc_${id}`).setLabel('💻 Copy PC').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rc_copymob_${id}`).setLabel('📱 Copy Mobile').setStyle(ButtonStyle.Secondary),
  );
}

async function validateCookie(cookie: string): Promise<boolean> {
  const cleanCookie = cookie.trim();
  const jar = new CookieJar();
  await jar.setCookie(`.ROBLOSECURITY=${cleanCookie}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
  const client = wrapper(axios.create({ jar }));
  try {
    const resp = await client.get('https://users.roblox.com/v1/users/authenticated', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
      },
      validateStatus: () => true,
    });
    return resp.status === 200;
  } catch {
    return false;
  }
}

function extractNewCookie(jar: CookieJar): string | null {
  const cookies = jar.getCookiesSync('https://roblox.com');
  const robloCookie = cookies.find(c => c.key === '.ROBLOSECURITY');
  if (robloCookie) {
    try { return decodeURIComponent(robloCookie.value); }
    catch { return robloCookie.value; }
  }
  return null;
}

async function processLogoutAll(cookie: string) {
  const cleanCookie = cookie.trim();
  const jar = new CookieJar();
  await jar.setCookie(`.ROBLOSECURITY=${cleanCookie}; Domain=.roblox.com; Path=/`, 'https://roblox.com');

  const client = wrapper(axios.create({ jar }));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://www.roblox.com',
    'Referer': 'https://www.roblox.com/',
    'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
  };

  const csrfHarvestUrl = 'https://auth.roblox.com/v2/logout';
  const reauthUrl = 'https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate';

  const csrfResp = await client.post(csrfHarvestUrl, {}, { headers, validateStatus: () => true });
  console.log(`[Roblox API Debug] CSRF harvest status: ${csrfResp.status}`);

  const csrf = csrfResp.headers['x-csrf-token'];
  if (!csrf) {
    console.log('[Roblox API Debug] No CSRF token returned on harvest step');
    return { success: false, newCookie: null };
  }

  headers['X-CSRF-TOKEN'] = csrf;

  const authResp = await client.post(reauthUrl, {}, { headers, validateStatus: () => true });
  console.log(`[Roblox API Debug] Reauth status: ${authResp.status}`);
  console.log('[Roblox API Debug] Response Body:', authResp.data);

  if (authResp.status !== 200) {
    return { success: false, newCookie: null };
  }

  let newCookie = extractNewCookie(jar);

  if (!newCookie && authResp.headers['set-cookie']) {
    const rawSetCookie = Array.isArray(authResp.headers['set-cookie'])
      ? authResp.headers['set-cookie'].join(';')
      : authResp.headers['set-cookie'];
    const match = rawSetCookie.match(/\.ROBLOSECURITY=([^;]+)/);
    if (match) {
      try { newCookie = decodeURIComponent(match[1]); }
      catch { newCookie = match[1]; }
    }
  }

  if (!newCookie || !(await validateCookie(newCookie))) {
    return { success: false, newCookie: null };
  }

  let ageRestriction = 'Unknown';
  let thumbnailUrl = '';
  let username = 'Unknown';
  let userId = '';

  try {
    const authUserResp = await client.get('https://users.roblox.com/v1/users/authenticated', {
      headers: { ...headers, 'Cookie': `.ROBLOSECURITY=${newCookie}` },
      validateStatus: () => true,
    });
    if (authUserResp.status === 200) {
      userId = authUserResp.data.id;
      username = authUserResp.data.name;
    }

    const settingsResp = await client.get('https://apis.roblox.com/user-settings-api/v1/user-settings', {
      headers: { ...headers, 'Cookie': `.ROBLOSECURITY=${newCookie}` },
      validateStatus: () => true,
    });
    if (settingsResp.status === 200) {
      ageRestriction = settingsResp.data.contentAgeRestriction || 'Unknown';
    }

    if (userId) {
      const thumbResp = await client.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`, { validateStatus: () => true });
      if (thumbResp.status === 200 && thumbResp.data.data.length > 0) {
        thumbnailUrl = thumbResp.data.data[0].imageUrl;
      }
    }
  } catch {}

  return { success: true, newCookie, ageRestriction, thumbnailUrl, username, userId };
}

const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset Cookie Session')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt => opt.setName('cookie').setDescription('The .ROBLOSECURITY cookie').setRequired(true)) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const oldCookie = interaction.options.getString('cookie', true);
  const timestamp = new Date().toLocaleString();
  const footerData = { text: `${interaction.user.username} | ${timestamp}`, iconURL: interaction.user.displayAvatarURL() };

  const progressEmbed = new EmbedBuilder()
    .setTitle('𖣐 Processing .ᐟ')
    .setColor('#FFFFFF')
    .setDescription(
      `✧ **Status:** Validating cookie...\n` +
      `────\n` +
      `⭑ Checking session authenticity with Roblox servers.`
    )
    .setFooter(footerData);

  await interaction.editReply({ embeds: [progressEmbed] });

  const isValid = await validateCookie(oldCookie);

  if (!isValid) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Invalid Cookie .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Error Occurred**\n` +
        `────\n` +
        `⭑ The provided cookie is not valid or has already expired.`
      )
      .setFooter(footerData);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  progressEmbed.setDescription(
    `✧ **Status:** Refreshing session...\n` +
    `────\n` +
    `⭑ Logging out all active sessions and generating a secure cookie.`
  );
  await interaction.editReply({ embeds: [progressEmbed] });

  const result = await processLogoutAll(oldCookie);

  if (result.success && result.newCookie) {
    const id = Math.random().toString(36).slice(2, 10);
    newCookieStore.set(id, result.newCookie);

    setTimeout(() => {
      newCookieStore.delete(id);
    }, 60000);

    const embed = new EmbedBuilder()
      .setTitle('𖣐 Success .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **User Information**\n` +
        `────\n` +
        `⭑ **Username:** ${result.username}\n` +
        `⭑ **User ID:** ${result.userId}\n` +
        `────\n` +
        `✧ **Account Details**\n` +
        `────\n` +
        `⭑ **Action:** Logout All Sessions\n` +
        `⭑ **Age Filter:** ${result.ageRestriction}`
      )
      .setFooter(footerData);

    if (result.thumbnailUrl) {
      embed.setThumbnail(result.thumbnailUrl);
    }

    await interaction.editReply({ embeds: [embed], components: [buildCopyButtons(id)] });
  } else {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Failed .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Error Occurred**\n` +
        `────\n` +
        `⭑ The request failed or the cookie was rejected by the server.`
      )
      .setFooter(footerData);
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith('rc_')) return;

  const id = customId.split('_')[2];

  if (customId.startsWith('rc_copypc_')) {
    const cookie = newCookieStore.get(id);
    if (!cookie) {
      await interaction.reply({ content: '𖣐 This button has expired. Please run the command again.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: `\`\`\`\n${cookie}\n\`\`\``, ephemeral: true });
    return;
  }

  if (customId.startsWith('rc_copymob_')) {
    const cookie = newCookieStore.get(id);
    if (!cookie) {
      await interaction.reply({ content: '𖣐 This button has expired. Please run the command again.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: `\`${cookie}\``, ephemeral: true });
    return;
  }
}

export const rcookieCommand: Command = { data, execute, handleButton };