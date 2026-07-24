import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type MessageComponentInteraction, MessageFlags } from 'discord.js';
import { storeCookie, getCookie } from './cookie-store';

export function buildCopyButtons(id: string, prefix: string, cookie: string, deliveredViaDM: boolean): ActionRowBuilder<ButtonBuilder> {
  storeCookie(id, cookie, deliveredViaDM);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_copypc_${id}`)
      .setLabel('💻 Copy PC')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${prefix}_copymob_${id}`)
      .setLabel('📱 Copy Mobile')
      .setStyle(ButtonStyle.Secondary)
  );
}

export async function handleCopyButtonClick(interaction: MessageComponentInteraction): Promise<boolean> {
  const match = interaction.customId.match(/^(.+)_(copypc|copymob)_(.+)$/);
  if (!match) return false;

  const [, , type, id] = match;
  const cookie = getCookie(id);

  if (!cookie) {
    await interaction.reply({
      content: '⚠️ This cookie is no longer available (expired after 20 minutes, or the bot restarted).',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (type === 'copypc') {
    await interaction.reply({ content: `\`\`\`\n${cookie}\n\`\`\``, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content: `\`${cookie}\``, flags: MessageFlags.Ephemeral });
  }
  return true;
}