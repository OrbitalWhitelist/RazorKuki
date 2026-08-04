import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as Roblox from '../../lib/roblox-api';
import { buildSuccessEmbed, buildErrorEmbed, buildProgressEmbed } from '../../lib/embed-helpers';
import { logger } from '../../lib/logger';
import type { Command } from './types';
import crypto from 'crypto';

async function getServerNonce(cookie: string): Promise<string> {
  const resp = await fetch('https://apis.roblox.com/hba-service/v1/getServerNonce', {
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!resp.ok) throw new Error(`Failed to get server nonce: ${resp.status}`);
  const data = (await resp.json()) as { nonce: string };
  return data.nonce;
}

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return { publicKey, privateKey };
}

function signPayload(privateKey: Buffer, data: string): Buffer {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey);
}

const data = new SlashCommandBuilder()
  .setName('cp')
  .setDescription('Change Password Directly')
  .addStringOption(opt =>
    opt.setName('cookie').setDescription('Insert The Cookies!').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('current_password').setDescription('Current password').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('new_password').setDescription('New password').setRequired(true)
  ) as SlashCommandBuilder;

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawCookie = interaction.options.getString('cookie', true);
    const currentPassword = interaction.options.getString('current_password', true);
    const newPassword = interaction.options.getString('new_password', true);

    const validation = await Roblox.validateCookie(rawCookie);
    if (!validation.valid) {
      const embed = validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const twoFactor = await Roblox.checkTwoFactorStatus(rawCookie, String(validation.userId!));
    if (twoFactor.enabled) {
      const embed = buildErrorEmbed(
        `✧ **2FA Detected**\n────\n` +
        `⭑ Authenticator is enabled on this account.\n` +
        `⭑ Password change is blocked for security.\n` +
        `⭑ Please disable 2FA first or use the official Roblox interface.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const progressEmbed = buildProgressEmbed('Preparing secure authentication...');
    await interaction.editReply({ embeds: [progressEmbed] });

    const nonce = await getServerNonce(rawCookie);
    const { publicKey, privateKey } = generateKeyPair();

    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = `${currentPassword}${newPassword}${timestamp}${nonce}`;
    const signature = signPayload(privateKey, payloadString);

    const secureAuthIntent = {
      clientPublicKey: publicKey.toString('base64'),
      clientEpochTimestamp: timestamp,
      serverNonce: nonce,
      saiSignature: signature.toString('base64'),
    };

    const csrf = await Roblox.getCsrfToken();
    if (!csrf) {
      await interaction.editReply({ embeds: [buildErrorEmbed('✧ **Failed to obtain CSRF token**\n────\n⭑ Please try again later.')] });
      return;
    }

    const changeResp = await fetch('https://auth.roblox.com/v2/user/passwords/change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-CSRF-TOKEN': csrf,
        'Cookie': `.ROBLOSECURITY=${rawCookie}`,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        secureAuthenticationIntent: secureAuthIntent,
      }),
    });

    if (changeResp.status === 200) {
      const embed = buildSuccessEmbed(
        '✧ **Password Changed**\n' +
        `────\n` +
        `⭑ Your password has been updated successfully.\n` +
        `⭑ Your credentials were not logged.`
      );
      await interaction.editReply({ embeds: [embed] });
    } else {
      let errorText = `HTTP ${changeResp.status}`;
      try {
        const err = await changeResp.json();
        if (err.message) errorText = err.message;
      } catch {}
      const embed = buildErrorEmbed(
        `✧ **Change Failed**\n────\n` +
        `⭑ ${errorText}\n` +
        `⭑ Please check your current password and try again.`
      );
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err: any) {
    logger.error({ err }, 'CP command error');
    await interaction.editReply({
      embeds: [buildErrorEmbed('✧ **Unexpected Error**\n────\n⭑ Something went wrong.')],
    });
  }
}

export const cpCommand: Command = { data, execute };