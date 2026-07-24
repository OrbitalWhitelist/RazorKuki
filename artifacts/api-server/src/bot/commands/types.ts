import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | { name: string; description: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  handleButton?: (interaction: MessageComponentInteraction) => Promise<void>;
  handleSelect?: (interaction: MessageComponentInteraction) => Promise<void>;
  handleModal?: (interaction: ModalSubmitInteraction) => Promise<void>;
}