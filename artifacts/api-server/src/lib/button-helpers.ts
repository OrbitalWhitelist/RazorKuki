import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildCopyButtons(id: string, prefix: string): ActionRowBuilder<ButtonBuilder> {
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

export function buildResultButtons(id: string, deliverDM: boolean): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (deliverDM) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`copy_dm_${id}`)
        .setLabel('📨 Copy via DM')
        .setStyle(ButtonStyle.Primary)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`copy_server_${id}`)
        .setLabel('📋 Copy Here')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return row;
}