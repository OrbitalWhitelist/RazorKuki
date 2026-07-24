import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { buildPanelEmbed, buildPanelSelect } from '../panel';
import { logger } from '../../lib/logger';
import type { Command } from './types';

const data = new SlashCommandBuilder()
  .setName('runpanel')
  .setDescription('Run the panel in a specific channel')
  .setDefaultMemberPermissions('0')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('The channel to send the panel to')
      .setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel', true);
    if (!channel.isTextBased()) {
      await interaction.editReply({ content: '❌ That is not a text channel.' });
      return;
    }

    const embed = buildPanelEmbed();
    const components = buildPanelSelect();

    await channel.send({ embeds: [embed], components: [components] });
    await interaction.editReply({ content: `✅ Panel sent to ${channel}` });
  } catch (err: any) {
    logger.error({ err }, 'RunPanel command error');
    await interaction.editReply({ content: '❌ Failed to send panel.' });
  }
}

export const runpanelCommand: Command = { data, execute };