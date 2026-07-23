import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Command } from './types';

const FULL_COOKIE_RE = /_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/;
const BARE_COOKIE_RE = /CAEQ[A-Za-z0-9._\-+=\/]{50,}/;

function extractCookie(text: string): string | null {
  const full = text.match(FULL_COOKIE_RE);
  if (full) return full[0];
  const bare = text.match(BARE_COOKIE_RE);
  if (bare) return bare[0];
  return null;
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

    const rawInput = interaction.options.getString('input', true);
    const cleaned = extractCookie(rawInput);

    if (!cleaned) {
      const embed = new EmbedBuilder()
        .setTitle('𖣐 No Cookie Found .ᐟ')
        .setColor('#FFFFFF')
        .setDescription('✧ **Error**\n────\n⭑ No `.ROBLOSECURITY` cookie found in the provided text.')
        .setFooter({
          text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
          iconURL: interaction.user.displayAvatarURL(),
        });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('𖣐 Cookie Extracted .ᐟ')
      .setColor('#FFFFFF')
      .setDescription(
        `✧ **Cleaned Cookie**\n` +
        `────\n` +
        `\`\`\`\n${cleaned}\n\`\`\`\n` +
        `────\n` +
        `⭑ Removed all extra text and comments.`
      )
      .setImage('https://files.catbox.moe/955g15.gif')
      .setFooter({
        text: `${interaction.user.username} | ${new Date().toLocaleString()}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [embed] });
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

export const clearCommand: Command = { data, execute };