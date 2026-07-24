import { EmbedBuilder } from 'discord.js';
import { EMOJIS } from './emoji';

export function buildBaseEmbed(title: string, description: string, footerText = 'Razor Tools On Top!', footerIcon = 'https://files.catbox.moe/955g15.gif'): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('#FFFFFF')
    .setDescription(description)
    .setImage('https://files.catbox.moe/955g15.gif')
    .setFooter({ text: footerText, iconURL: footerIcon });
}

export function buildSuccessEmbed(description: string): EmbedBuilder {
  return buildBaseEmbed('𖣐 Success .ᐟ', description);
}

export function buildErrorEmbed(description: string): EmbedBuilder {
  return buildBaseEmbed('𖣐 Failed!', description);
}

export function buildInvalidCookieEmbed(): EmbedBuilder {
  return buildErrorEmbed('✧ **Invalid Cookie**\n────\n⭑ The provided cookie is not valid or has expired.');
}

export function buildIpLimitEmbed(): EmbedBuilder {
  return buildErrorEmbed('✧ **IP Limits, Try Again**\n────\n⭑ Too many requests to Roblox servers. Please wait a moment and try again.');
}

export function buildTimeoutEmbed(): EmbedBuilder {
  return buildErrorEmbed('✧ **Try Again**\n────\n⭑ The request timed out. Please try again later.');
}

export function buildProgressEmbed(step: string): EmbedBuilder {
  return buildBaseEmbed('𖣐 Processing .ᐟ', `✧ **Status:** ${step}\n────\n⭑ Please wait...`);
}

export function buildAccountEmbed(
  username: string,
  displayName: string | null,
  userId: number,
  ageDays: number,
  robux: number,
  country: string,
  emailStatus: string,
  parentalStatus: string,
  thumbnail?: string | null
): EmbedBuilder {
  const ageText = ageDays === -1 ? 'Unknown' : `${ageDays} days`;
  const embed = buildBaseEmbed('𖣐 Cookie Valid .ᐟ',
    `✧ **User Information**\n` +
    `────\n` +
    `⭑ **Username:** ${username}\n` +
    `⭑ **Display Name:** ${displayName || username}\n` +
    `⭑ **User ID:** ${userId}\n` +
    `⭑ **Country:** ${country}\n` +
    `⭑ **Account Age:** ${ageText}\n` +
    `${EMOJIS.ROBUX} **Robux:** ${robux.toLocaleString()}\n` +
    `────\n` +
    `✧ **Account Details**\n` +
    `────\n` +
    `⭑ **Email:** ${emailStatus}\n` +
    `⭑ **Parental Controls:** ${parentalStatus}\n` +
    `────\n` +
    `⭑ Your credentials were not logged.`
  );
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export function buildBypassNoMailEmbed(username: string): EmbedBuilder {
  return buildSuccessEmbed(
    '✧ **Bypass Result**\n' +
    `────\n` +
    `⭑ **Status:** Success, No Mails Detected!\n` +
    `⭑ **Username:** ${username}\n` +
    `⭑ Your credentials were not logged.`
  );
}