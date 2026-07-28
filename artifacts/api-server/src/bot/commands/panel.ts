import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
  MessageFlags,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import * as Roblox from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
  buildBaseEmbed,
} from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import {
  runLoginAction,
  runRefreshAction,
  runResetAction,
  runBypassAction,
  runClearAction,
  runChangePasswordAction,
} from '../../lib/actions';

const modalSessions = new Map<string, { action: string }>();

export function buildPanelEmbed() {
  return buildBaseEmbed(
    '✧ 𝐑𝐚𝐳𝐨𝐫 𝐓𝐨𝐨𝐥𝐬 𝐗𝐏 ✧',
    '──── ּ ֶָ֢.\n' +
    '⭑ 𝑷𝒊𝒍𝒊𝒉 𝑭𝒊𝒕𝒖𝒓 𝑫𝒊𝒃𝒂𝒘𝒂𝒉! / 𝑪𝒉𝒐𝒐𝒔𝒆 𝑭𝒆𝒂𝒕𝒖𝒓𝒆𝒔 𝑩𝒆𝒍𝒐𝒘!\n' +
    '⭑ 𝑫𝒊𝒃𝒖𝒕𝒖𝒉𝒌𝒂𝒏 𝑫𝒂𝒕𝒂 𝑳𝒐𝒈𝒊𝒏 / 𝑳𝒐𝒈𝒊𝒏 𝑪𝒓𝒆𝒅𝒆𝒏𝒕𝒊𝒂𝒍𝒔 𝑹𝒆𝒒𝒖𝒊𝒓𝒆𝒅.\n' +
    '⭑ 𝑶𝒑𝒕𝒊𝒐𝒏𝒔 𝑹𝒆𝒔𝒖𝒍𝒕 𝑺𝒆𝒏𝒅𝒆𝒅 𝑻𝒐 : 𝑺𝒆𝒓𝒗𝒆𝒓 / 𝑫𝑴\n' +
    '──── ּ ֶָ֢.\n' +
    '✧ 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨:\n' +
    '• 𝙇𝙤𝙜𝙞𝙣 – 𝘾𝙝𝙚𝙘𝙠 𝘼𝙘𝙘𝙤𝙪𝙣𝙩 𝙄𝙣𝙛𝙤 \n' +
    '• 𝙍𝙚𝙛𝙧𝙚𝙨𝙝 – 𝙍𝙚𝙛𝙧𝙚𝙨𝙝𝙞𝙣𝙜 𝘾𝙤𝙤𝙠𝙞𝙚 \n' +
    '• 𝙍𝙚𝙨𝙚𝙩 – 𝙇𝙤𝙜𝙤𝙪𝙩 𝙊𝙩𝙝𝙚𝙧𝙨 & 𝙍𝙚𝙘𝙞𝙚𝙫𝙚 𝙉𝙚𝙬 𝘾𝙤𝙤𝙠𝙞𝙚 \n' +
    '• 𝘽𝙮𝙥𝙖𝙨𝙨 – 𝙀𝙢𝙖𝙞𝙡𝙨 𝙍𝙚𝙢𝙤𝙫𝙞𝙣𝙜 \n' +
    '• 𝘾𝙝𝙚𝙘𝙠 – 𝙈𝙖𝙨𝙨 𝘾𝙝𝙚𝙘𝙠𝙨 \n' +
    '• 𝘾𝙡𝙚𝙖𝙧 – 𝘾𝙡𝙚𝙖𝙧 𝘾𝙤𝙤𝙠𝙞𝙚𝙨 \n' +
    '• 𝘾𝙋 – 𝘾𝙝𝙖𝙣𝙜𝙚𝙨 𝙋𝙖𝙨𝙨𝙬𝙤𝙧𝙙 \n' +
    '────────────────────────────',
    'Razor Tools On Top!'
  );
}

export function buildPanelSelect() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('panel_select')
    .setPlaceholder('Choose an action')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔐 Login / Check')
        .setValue('login')
        .setDescription('Validate and show account info'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Refresh (Safe)')
        .setValue('refresh')
        .setDescription('Refresh cookie without killing other sessions'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Reset (Kill)')
        .setValue('reset')
        .setDescription('Kill all sessions and get fresh cookie'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚡ Bypass')
        .setValue('bypass')
        .setDescription('Attempt age verification bypass'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📂 Mass Check')
        .setValue('check')
        .setDescription('Use /check command for file upload'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧹 Clear Cookie')
        .setValue('clear')
        .setDescription('Extract raw cookie from messy text'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔑 CP')
        .setValue('cp')
        .setDescription('Change Password Directly')
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Open the Razor Tools control panel in this channel')
  .setDefaultMemberPermissions('0') as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    embeds: [buildPanelEmbed()],
    components: [buildPanelSelect()],
  });
}

async function handleSelect(interaction: MessageComponentInteraction): Promise<void> {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'panel_select') return;

  const action = interaction.values[0];
  const userId = interaction.user.id;

  if (action === 'check') {
    await interaction.reply({
      content: '📂 Please use the `/check` command directly to upload a file.\nThis action is not available in the panel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`panel_modal_${action}_${userId}`)
    .setTitle(`Razor Tools – ${action.charAt(0).toUpperCase() + action.slice(1)}`);

  let fields: TextInputBuilder[] = [];

  if (action === 'clear') {
    const cookieInput = new TextInputBuilder()
      .setCustomId('cookie')
      .setLabel('Insert The Cookies!')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Insert here...');
    fields.push(cookieInput);
  } else if (action === 'bypass' || action === 'cp') {
    const cookieInput = new TextInputBuilder()
      .setCustomId('cookie')
      .setLabel('Insert The Cookies!')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Insert here...');
    fields.push(cookieInput);
    const passInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Password')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Insert here...');
    fields.push(passInput);
    if (action === 'cp') {
      const newPassInput = new TextInputBuilder()
        .setCustomId('new_password')
        .setLabel('New Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter new password');
      fields.push(newPassInput);
    } else if (action === 'bypass') {
      const newEmailInput = new TextInputBuilder()
        .setCustomId('new_email')
        .setLabel('New Email (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Leave blank if not needed');
      fields.push(newEmailInput);
      const newPassInput = new TextInputBuilder()
        .setCustomId('new_password')
        .setLabel('New Password (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Leave blank if not needed');
      fields.push(newPassInput);
    }
  } else {
    const cookieInput = new TextInputBuilder()
      .setCustomId('cookie')
      .setLabel('Insert The Cookies!')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Insert here...');
    fields.push(cookieInput);
  }

  const deliveryInput = new TextInputBuilder()
    .setCustomId('delivery')
    .setLabel('Send To S/D? (S - SERVER | D - DM)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue('S')
    .setPlaceholder('S or D');
  fields.push(deliveryInput);

  const rows = fields.map(f => new ActionRowBuilder<TextInputBuilder>().addComponents(f));
  modal.addComponents(...rows);

  modalSessions.set(`${action}_${userId}`, { action });
  await interaction.showModal(modal);
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const userId = interaction.user.id;
  const parts = interaction.customId.split('_');
  const action = parts[2];
  const sessionKey = `${action}_${userId}`;
  const session = modalSessions.get(sessionKey);
  if (!session) {
    await interaction.reply({ content: 'Session expired. Please open the panel again.', flags: MessageFlags.Ephemeral });
    return;
  }

  let cookie = '';
  let password = '';
  let newPassword = '';
  let newEmail = '';

  try {
    cookie = interaction.fields.getTextInputValue('cookie') || '';
  } catch {}
  try {
    password = interaction.fields.getTextInputValue('password') || '';
  } catch {}
  try {
    newPassword = interaction.fields.getTextInputValue('new_password') || '';
  } catch {}
  try {
    newEmail = interaction.fields.getTextInputValue('new_email') || '';
  } catch {}

  const deliveryRaw = interaction.fields.getTextInputValue('delivery').toUpperCase().trim();
  const delivery = (deliveryRaw === 'D') ? 'dm' : 'server';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  async function sendResult(content: any) {
    if (delivery === 'dm') {
      try {
        await interaction.user.send(content);
        await interaction.editReply({ content: '✅ Result sent to your DMs.' });
      } catch {
        await interaction.editReply(content);
      }
    } else {
      await interaction.editReply(content);
    }
  }

  try {
    let result;
    switch (action) {
      case 'login':
        result = await runLoginAction(cookie);
        break;
      case 'refresh':
        result = await runRefreshAction(cookie);
        if (result.success && result.newCookie) {
          const id = Math.random().toString(36).slice(2, 10);
          const row = buildCopyButtons(id, 'refresh', result.newCookie, delivery === 'dm');
          await sendResult({ embeds: [result.embed], components: [row] });
          modalSessions.delete(sessionKey);
          return;
        }
        break;
      case 'reset':
        result = await runResetAction(cookie);
        if (result.success && result.newCookie) {
          const id = Math.random().toString(36).slice(2, 10);
          const row = buildCopyButtons(id, 'reset', result.newCookie, delivery === 'dm');
          await sendResult({ embeds: [result.embed], components: [row] });
          modalSessions.delete(sessionKey);
          return;
        }
        break;
      case 'bypass':
        result = await runBypassAction(cookie, password, newEmail, newPassword);
        if (result.success && result.newCookie) {
          const id = Math.random().toString(36).slice(2, 10);
          const row = buildCopyButtons(id, 'bypass', result.newCookie, delivery === 'dm');
          await sendResult({ embeds: [result.embed], components: [row] });
          modalSessions.delete(sessionKey);
          return;
        }
        break;
      case 'clear':
        result = await runClearAction(cookie);
        if (result.success && result.cleanedCookie) {
          const id = Math.random().toString(36).slice(2, 10);
          const row = buildCopyButtons(id, 'clear', result.cleanedCookie, delivery === 'dm');
          await sendResult({ embeds: [result.embed], components: [row] });
          modalSessions.delete(sessionKey);
          return;
        }
        break;
      case 'cp':
        result = await runChangePasswordAction(cookie, password, newPassword);
        break;
      default:
        await sendResult({ embeds: [buildErrorEmbed('✧ **Unknown Action**\n────\n⭑ Something went wrong.')] });
        modalSessions.delete(sessionKey);
        return;
    }
    // For actions that don't return a new cookie, just send the embed
    await sendResult({ embeds: [result.embed] });
  } catch (err: any) {
    logger.error({ err }, 'Panel modal error');
    await sendResult({ embeds: [buildErrorEmbed('✧ **Error**\n────\n⭑ An unexpected error occurred.')] });
  }

  modalSessions.delete(sessionKey);
}

export const panelCommand: Command = { data, execute, handleSelect, handleModal };