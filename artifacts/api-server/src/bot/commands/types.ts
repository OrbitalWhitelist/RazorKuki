import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  handleButton?: (interaction: MessageComponentInteraction) => Promise<void>;
  handleSelect?: (interaction: MessageComponentInteraction) => Promise<void>;
  handleModal?: (interaction: ModalSubmitInteraction) => Promise<void>;
}