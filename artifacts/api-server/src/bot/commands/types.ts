import type {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  SlashCommandBuilder,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  handleButton?(interaction: MessageComponentInteraction): Promise<void>;
}
