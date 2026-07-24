// src/bot/commands/prefix.ts
import { buildPanelEmbed, buildPanelSelect } from './panel';
import type { TextBasedChannel } from 'discord.js';

export async function handleRunPanel(channel: TextBasedChannel): Promise<void> {
  const embed = buildPanelEmbed();
  const components = buildPanelSelect();
  await channel.send({ embeds: [embed], components: [components] });
}

export async function handleSend(channel: TextBasedChannel, message: string): Promise<void> {
  await channel.send({ content: message });
}