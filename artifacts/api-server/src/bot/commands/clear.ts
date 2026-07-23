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
import type { Command } from './types';

const TOKEN_RE = /CAEQ[A-Za-z0-9._\-+=\/]+/;
const WARNING_PREFIX = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';

function extractRawToken(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith(WARNING_PREFIX)) {
    const rest = trimmed.slice(WARNING_PREFIX.length);
    const match = rest.match(TOKEN_RE);
    if (match) return match[0];
  }
  const match = trimmed.match(TOKEN_RE);
  if (match) return match[0];
  return null;
}

const store = new Map<string, string>();

function buildClearButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`clear_copypc_${id}`)
      .setLabel('💻 Copy PC')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`clear_copymob_${id}`)
      .setLabel('📱 Copy Mobile')
      .setStyle(ButtonStyle.Secondary),
  );
}

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear Cookies Format')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt.setName('input')
      .setDescription('Raw cookie text with extra characters')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const raw = interaction.options.getString('input', true);
    const cleaned = extractRawToken(raw);

    if (!cleaned) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 No Cookie Found .ᐟ')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ No `.ROBLOSECURITY` token found in the provided text.')
        .setFooter({
          text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
          iconURL: interaction.user.displayAvatarURL(),
        });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const id = Math.random().toString(36).slice(2, 10);
    store.set(id, cleaned);
    setTimeout(() => store.delete(id), 300000);

    const embed = new EmbedBuilder()
      .setTitle('𖣐 Cookie Extracted .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Cleaned Cookie**\n` +
        `────\n` +
        `\`\`\`\n${cleaned}\n\`\`\`\n` +
        `────\n` +
        `⭑ Removed warning prefix and extra text.`
      )
      .setImage('https://files.catbox.moe/955g15.gif')
      .setFooter({
        text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [embed], components: [buildClearButtons(id)] });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setTitle('𖣐 Error .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(`✧ **Unexpected Error**\n────\n⭑ ${error.message || 'Something went wrong.'}`)
      .setFooter({
        text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
        iconURL: interaction.user.displayAvatarURL(),
      });
    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleButton(interaction: MessageComponentInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    if (!customId.startsWith('clear_')) return;
    const parts = customId.split('_');
    const action = parts[1];
    const id = parts[2];
    const token = store.get(id);
    if (!token) {
      await interaction.reply({ content: '𖣐 This button has expired. Please run the command again.', ephemeral: true });
      return;
    }
    if (action === 'copypc') {
      await interaction.reply({ content: `\`\`\`\n${token}\n\`\`\``, ephemeral: true });
    } else if (action === 'copymob') {
      await interaction.reply({ content: `\`${token}\``, ephemeral: true });
    }
  } catch (error: any) {
    await interaction.reply({ content: `𖣐 Error: ${error.message || 'Something went wrong.'}`, ephemeral: true });
  }
}

export const clearCommand: Command = { data, execute, handleButton };