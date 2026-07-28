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

function buildAccountEmbedLocal(
  username: string,
  displayName: string | null,
  userId: number,
  ageDays: number,
  robux: number,
  summary: { incoming: number; outgoing: number },
  country: string,
  emailStatus: string,
  parentalStatus: string,
  thumbnail?: string | null
) {
  const ageText = ageDays === -1 ? 'Unknown' : `${ageDays} days`;
  const embed = buildBaseEmbed(
    '𖣐 Cookie Valid .ᐟ',
    `✧ **User Information**\n` +
    `────\n` +
    `⭑ **Username:** ${username}\n` +
    `⭑ **Display Name:** ${displayName || username}\n` +
    `⭑ **User ID:** ${userId}\n` +
    `⭑ **Country:** ${country}\n` +
    `⭑ **Account Age:** ${ageText}\n` +
    `⭑ **Robux:** ${robux.toLocaleString()}\n` +
    `────\n` +
    `✧ **Robux Summary (Year)**\n` +
    `────\n` +
    `⭑ **Incoming:** ${summary.incoming.toLocaleString()}\n` +
    `⭑ **Outgoing:** ${summary.outgoing.toLocaleString()}\n` +
    `────\n` +
    `✧ **Account Details**\n` +
    `────\n` +
    `⭑ **Email:** ${emailStatus}\n` +
    `⭑ **Parental Controls:** ${parentalStatus}\n` +
    `────\n` +
    `⭑ Your credentials were not logged.`
  );
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
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
    if (action === 'login') {
      const validation = await Roblox.validateCookie(cookie);
      if (!validation.valid) {
        const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
      const userId = validation.userId!;
      const age = await Roblox.getUserAge(userId);
      const robux = await Roblox.fetchRobux(cookie, String(userId));
      const summary = await Roblox.fetchTransactionTotals(cookie, String(userId));
      const country = await Roblox.fetchCountry(cookie);
      const email = await Roblox.fetchEmailInfo(cookie);
      const parental = await Roblox.fetchParentalControls(cookie);
      const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

      let emailStatus = 'No email found';
      if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
      else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;
      const parentStatus = parental.hasParent ? '✅ Parent linked' : '❌ No parent linked';

      const embed = buildAccountEmbedLocal(
        validation.username!,
        validation.displayName || null,
        userId,
        age,
        robux,
        summary,
        country,
        emailStatus,
        parentStatus,
        thumb
      );
      await sendResult({ embeds: [embed] });
    } else if (action === 'refresh') {
      const validation = await Roblox.validateCookie(cookie);
      if (!validation.valid) {
        const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
      const result = await Roblox.refreshSession(cookie);
      if (result.success && result.newCookie) {
        const embed = buildSuccessEmbed(
          '✧ **Refresh Successful**\n' +
          `────\n` +
          `⭑ New cookie issued.\n` +
          `⭑ Your other sessions remain active.\n` +
          `⭑ Your credentials were not logged.`
        );
        const id = Math.random().toString(36).slice(2, 10);
        const row = buildCopyButtons(id, 'refresh', result.newCookie, delivery === 'dm');
        await sendResult({ embeds: [embed], components: [row] });
      } else {
        await sendResult({ embeds: [buildErrorEmbed('✧ **Refresh Failed**\n────\n⭑ Could not refresh the session. Please try again later.')] });
      }
    } else if (action === 'reset') {
      const validation = await Roblox.validateCookie(cookie);
      if (!validation.valid) {
        const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
      const result = await Roblox.killAndRefreshSession(cookie);
      if (result.success && result.newCookie) {
        const embed = buildSuccessEmbed(
          '✧ **Reset Successful**\n' +
          `────\n` +
          `⭑ New cookie issued.\n` +
          `⭑ Old session killed.\n` +
          `⭑ Your credentials were not logged.`
        );
        const id = Math.random().toString(36).slice(2, 10);
        const row = buildCopyButtons(id, 'reset', result.newCookie, delivery === 'dm');
        await sendResult({ embeds: [embed], components: [row] });
      } else {
        await sendResult({ embeds: [buildErrorEmbed('✧ **Reset Failed**\n────\n⭑ Could not refresh the session. Please try again later.')] });
      }
    } else if (action === 'bypass') {
      const validation = await Roblox.validateCookie(cookie);
      if (!validation.valid) {
        const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
      const userId = validation.userId!;
      const age = await Roblox.getUserAge(userId);
      const robux = await Roblox.fetchRobux(cookie, String(userId));
      const summary = await Roblox.fetchTransactionTotals(cookie, String(userId));
      const country = await Roblox.fetchCountry(cookie);
      const email = await Roblox.fetchEmailInfo(cookie);
      const parental = await Roblox.fetchParentalControls(cookie);
      const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

      let emailStatus = 'No email found';
      if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
      else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;
      const parentStatus = parental.hasParent ? '✅ Parent linked' : '❌ No parent linked';

      const shouldRunBypass = email.verified && !newEmail && !newPassword;
      if (shouldRunBypass) {
        const progressEmbed = buildProgressEmbed('Sending bypass request...');
        await sendResult({ embeds: [progressEmbed] });

        let lastMessage = 'Sending bypass request...';
        let attempts = 0;
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
            attempts = attempt;
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
          let newCookie = (result as any).newCookie;
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

          const embed = buildAccountEmbedLocal(
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
        } else if ((result as any).timedOut) {
          const embed = buildProgressEmbed('Bypass is still in progress. Please check later.');
          await sendResult({ embeds: [embed] });
        } else {
          const embed = buildErrorEmbed(`✧ **Bypass Failed**\n────\n⭑ ${result.message}`);
          await sendResult({ embeds: [embed] });
        }
        modalSessions.delete(sessionKey);
        return;
      }

      let successMessages = [];
      if (!email.verified && newEmail) {
        const addEmailResult = await Roblox.addPendingEmail(cookie, newEmail, password);
        if (addEmailResult.success) {
          successMessages.push(`📧 Pending email added: ${newEmail}`);
        } else {
          successMessages.push(`❌ Failed to add pending email: ${addEmailResult.error}`);
        }
      }
      if (newPassword) {
        const changePassResult = await Roblox.changePassword(cookie, password, newPassword);
        if (changePassResult.success) {
          successMessages.push(`🔑 Password changed successfully!`);
        } else {
          successMessages.push(`❌ Password change failed: ${changePassResult.error}`);
        }
      }
      if (successMessages.length === 0) {
        const embed = buildErrorEmbed('✧ **No Action Taken**\n────\n⭑ No new email or password provided, and bypass not run.');
        await sendResult({ embeds: [embed] });
      } else {
        const embed = buildSuccessEmbed(
          '✧ **Actions Completed**\n' +
          `────\n` +
          successMessages.map(msg => `⭑ ${msg}`).join('\n') +
          `\n────\n` +
          `⭑ Your credentials were not logged.`
        );
        await sendResult({ embeds: [embed] });
      }
    } else if (action === 'clear') {
      const cleaned = Roblox.extractCookie(cookie);
      if (!cleaned) {
        await sendResult({ embeds: [buildErrorEmbed('✧ **No Cookie Found**\n────\n⭑ No valid cookie token found.')] });
      } else {
        const embed = buildSuccessEmbed(
          '✧ **Cleaned Cookie**\n' +
          `────\n` +
          `\`\`\`\n${cleaned}\n\`\`\`\n` +
          `────\n` +
          `⭑ Removed warning prefix and extra text.`
        );
        const id = Math.random().toString(36).slice(2, 10);
        const row = buildCopyButtons(id, 'clear', cleaned, delivery === 'dm');
        await sendResult({ embeds: [embed], components: [row] });
      }
    } else if (action === 'cp') {
      const validation = await Roblox.validateCookie(cookie);
      if (!validation.valid) {
        const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
      if (!password || !newPassword) {
        await sendResult({ embeds: [buildErrorEmbed('✧ **Missing Credentials**\n────\n⭑ Both current and new password are required.')] });
        modalSessions.delete(sessionKey);
        return;
      }
      const twoFactor = await Roblox.checkTwoFactorStatus(cookie, String(validation.userId!));
      if (twoFactor.enabled) {
        const embed = buildErrorEmbed(
          `✧ **2FA Detected**\n────\n` +
          `⭑ Authenticator is enabled on this account.\n` +
          `⭑ Password change is blocked for security.\n` +
          `⭑ Please disable 2FA first or use the official Roblox interface.`
        );
        await sendResult({ embeds: [embed] });
        modalSessions.delete(sessionKey);
        return;
      }
      const progressEmbed = buildProgressEmbed('Changing password...');
      await sendResult({ embeds: [progressEmbed] });
      const result = await Roblox.changePassword(cookie, password, newPassword);
      if (result.success) {
        const embed = buildSuccessEmbed(
          '✧ **Password Changed**\n' +
          `────\n` +
          `⭑ Your password has been updated successfully.\n` +
          `⭑ Your credentials were not logged.`
        );
        await sendResult({ embeds: [embed] });
      } else {
        const embed = buildErrorEmbed(
          `✧ **Change Failed**\n────\n` +
          `⭑ ${result.error || 'Unknown error'}\n` +
          `⭑ Please check your current password and try again.`
        );
        await sendResult({ embeds: [embed] });
      }
    }
  } catch (err: any) {
    logger.error({ err }, 'Panel modal error');
    await sendResult({ embeds: [buildErrorEmbed('✧ **Error**\n────\n⭑ An unexpected error occurred.')] });
  }

  modalSessions.delete(sessionKey);
}

export const panelCommand: Command = { data, execute, handleSelect, handleModal };