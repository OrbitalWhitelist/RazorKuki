import { buildPanelEmbed, buildPanelSelect } from './panel';
import type { TextBasedChannel } from 'discord.js';

export async function handleRunPanel(channel: TextBasedChannel): Promise<void> {
  const embed = buildPanelEmbed();
  const components = buildPanelSelect();
  await channel.send({ embeds: [embed], components: [components] });
}

export async function handleSend(channel: TextBasedChannel, message: string): Promise<void> {
  const formatted = message
    .replace(/:Verification:/g, '<a:Verification:1118968927377182771>')
    .replace(/:verification:/g, '<a:Verification:1118968927377182771>');
  await channel.send({ content: formatted });
}