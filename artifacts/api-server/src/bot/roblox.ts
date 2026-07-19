import axios from 'axios';

export interface ValidateResult {
  valid: boolean;
  username?: string;
  displayName?: string;
  userId?: number;
  debug: string;
}

export async function validateCookie(cookie: string): Promise<ValidateResult> {
  const debug: string[] = [];
  const log = (msg: string) => { debug.push(msg); console.log('[VALIDATE]', msg); };
  const trimmed = cookie.trim();
  log(`Cookie length: ${trimmed.length}`);
  try {
    const resp = await axios.get('https://users.roblox.com/v1/users/authenticated', {
      headers: { Cookie: `.ROBLOSECURITY=${trimmed}`, 'User-Agent': 'Mozilla/5.0' },
      validateStatus: () => true,
    });
    log(`Status: ${resp.status}`);
    if (resp.status === 200) {
      const { id, name, displayName } = resp.data;
      log(`User: ${name} (${displayName}) ID ${id}`);
      return { valid: true, username: name, displayName, userId: id, debug: debug.join('\n') };
    }
    if (resp.status === 401) log('Invalid cookie');
    return { valid: false, debug: debug.join('\n') };
  } catch (err: any) {
    log(`Error: ${err.message}`);
    return { valid: false, debug: debug.join('\n') };
  }
}

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string;
}

export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const debug: string[] = [];
  const log = (msg: string) => { debug.push(msg); console.log('[REFRESH]', msg); };
  const trimmed = cookie.trim();
  log(`Cookie length: ${trimmed.length}`);
  const baseHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: `.ROBLOSECURITY=${trimmed}`,
  };
  try {
    log('POST /v2/logout (get CSRF)');
    const csrfResp = await axios.post('https://auth.roblox.com/v2/logout', {}, { headers: baseHeaders, validateStatus: () => true });
    log(`Status: ${csrfResp.status}`);
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) { log('Cookie expired'); return { newCookie: null, status: 'COOKIE_EXPIRED', debug: debug.join('\n') }; }
      log(`No CSRF (${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: debug.join('\n') };
    }
    log(`CSRF: ${csrf.slice(0,20)}…`);
    log('POST /v2/session/refresh');
    const refreshHeaders = { ...baseHeaders, 'X-CSRF-TOKEN': csrf };
    const refreshResp = await axios.post('https://auth.roblox.com/v2/session/refresh', {}, { headers: refreshHeaders, validateStatus: () => true });
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
      if (newCookie) {
        log(`New cookie: ${newCookie.slice(0,10)}…`);
        return { newCookie, status: 'SUCCESS', debug: debug.join('\n') };
      }
      log('No new cookie found');
      return { newCookie: null, status: 'SUCCESS_NO_COOKIE', debug: debug.join('\n') };
    }
    log(`Refresh failed (${refreshResp.status})`);
    return { newCookie: null, status: `ERROR_${refreshResp.status}`, debug: debug.join('\n') };
  } catch (err: any) {
    log(`Network error: ${err.message}`);
    return { newCookie: null, status: `NETWORK_ERROR_${err.message}`, debug: debug.join('\n') };
  }
}

export async function resetCookie(cookie: string): Promise<RefreshResult> {
  const debug: string[] = [];
  const log = (msg: string) => { debug.push(msg); console.log('[RESET]', msg); };
  const trimmed = cookie.trim();
  log(`Cookie length: ${trimmed.length}`);
  const baseHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: `.ROBLOSECURITY=${trimmed}`,
  };
  try {
    log('POST /v2/logout (get CSRF)');
    const csrfResp = await axios.post('https://auth.roblox.com/v2/logout', {}, { headers: baseHeaders, validateStatus: () => true });
    log(`Status: ${csrfResp.status}`);
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) { log('Cookie expired'); return { newCookie: null, status: 'COOKIE_EXPIRED', debug: debug.join('\n') }; }
      log(`No CSRF (${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: debug.join('\n') };
    }
    log(`CSRF: ${csrf.slice(0,20)}…`);
    log('POST /v2/logoutfromallsessionsandreauthenticate (destructive)');
    const resetHeaders = { ...baseHeaders, 'X-CSRF-TOKEN': csrf };
    const resetResp = await axios.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, { headers: resetHeaders, validateStatus: () => true });
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
      if (newCookie) {
        log(`New cookie (reset): ${newCookie.slice(0,10)}…`);
        return { newCookie, status: 'SUCCESS', debug: debug.join('\n') };
      }
      log('No new cookie found in reset response');
      return { newCookie: null, status: 'SUCCESS_NO_COOKIE', debug: debug.join('\n') };
    }
    log(`Reset failed (${resetResp.status})`);
    if (resetResp.data) log(`Body: ${JSON.stringify(resetResp.data)}`);
    return { newCookie: null, status: `ERROR_${resetResp.status}`, debug: debug.join('\n') };
  } catch (err: any) {
    log(`Network error: ${err.message}`);
    return { newCookie: null, status: `NETWORK_ERROR_${err.message}`, debug: debug.join('\n') };
  }
}