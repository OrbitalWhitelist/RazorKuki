import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';
import { logger } from '../../lib/logger';
import type { Command } from './types';

function isOwner(userId: string): boolean {
  const ids = (process.env.OWNER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

const data = new SlashCommandBuilder()
  .setName('kickall')
  .setDescription('Kick all kickable members (OWNER ONLY)')
  .addStringOption(opt =>
    opt.setName('confirm').setDescription('Type CONFIRM to proceed').setRequired(true)
  )
  .setDefaultMemberPermissions('0') as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: '❌ Owner only.', flags: MessageFlags.Ephemeral });
    return;
  }

  const confirm = interaction.options.getString('confirm', true).trim().toUpperCase();
  if (confirm !== 'CONFIRM') {
    await interaction.reply({ content: '❌ Cancelled. Type `CONFIRM` exactly to proceed.', flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ Must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const me = guild.members.me;
  if (!me || !me.permissions.has(PermissionFlagsBits.KickMembers)) {
    await interaction.reply({ content: '❌ I need the **Kick Members** permission.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const members = await guild.members.fetch();
  const botTopRole = me.roles.highest.position;

  const targets = members.filter(m => {
    if (m.id === guild.ownerId) return false;
    if (m.user.bot && m.id === interaction.client.user?.id) return false;
    if (m.id === interaction.user.id) return false;
    if (m.roles.highest.position >= botTopRole) return false;
    return true;
  });

  if (targets.size === 0) {
    await interaction.editReply({ content: '⚠️ No kickable members found.' });
    return;
  }

  const previewEmbed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('⚠️ Kick All Confirmation')
    .setDescription(
      `You are about to kick **${targets.size}** members from **${guild.name}**.\n\n` +
      `This action cannot be undone.\n\nPress **Confirm** within 30 seconds.`
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('kickall_confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('kickall_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [previewEmbed], components: [row] });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30000,
    max: 1,
    filter: (i) => i.user.id === interaction.user.id,
  });

  if (!collector) return;

  collector.on('collect', async (btn: MessageComponentInteraction) => {
    if (btn.customId === 'kickall_cancel') {
      await btn.update({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Cancelled.')], components: [] });
      return;
    }

    await btn.update({
      embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`🔁 Kicking ${targets.size} members...`)],
      components: [],
    });

    let kicked = 0;
    let failed = 0;
    const failedIds: string[] = [];

    for (const [id, member] of targets) {
      try {
        await member.kick('Owner initiated kick-all');
        kicked++;
      } catch (err) {
        failed++;
        failedIds.push(id);
        logger.warn({ id, err }, 'kickall: failed to kick member');
      }
      if ((kicked + failed) % 25 === 0) {
        await btn.editReply({
          embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(`🔁 Progress: ${kicked + failed}/${targets.size}`)],
        }).catch(() => {});
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    logger.info({ guildId: guild.id, kicked, failed }, '[KICKALL] finished');

    const resultEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Kick All Complete')
      .addFields(
        { name: 'Kicked', value: `${kicked}`, inline: true },
        { name: 'Failed', value: `${failed}`, inline: true },
        { name: 'Total', value: `${targets.size}`, inline: true },
      )
      .setFooter({ text: 'Logged to Termux' });

    await btn.editReply({ embeds: [resultEmbed] }).catch(() => {});
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('⏰ Timed out. Nothing was kicked.')], components: [] }).catch(() => {});
    }
  });
}

async function handleButton(): Promise<void> {}

export const kickallCommand: Command = { data, execute, handleButton };