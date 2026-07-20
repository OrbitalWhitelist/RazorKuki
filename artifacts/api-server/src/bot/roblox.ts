import axios from 'axios';

export interface ValidateResult {
  valid: boolean;
  username?: string;
  displayName?: string;
  userId?: number;
  debug: string;
}

export async function validateCookie(cookie: string): Promise<ValidateResult> {
  const lines: string[] = [];
  const log = (msg: string) => { lines.push(msg); console.log('[VALIDATE]', msg); };
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
      return { valid: true, username: name, displayName, userId: id, debug: lines.join('\n') };
    }
    if (resp.status === 401) log('Invalid or expired cookie');
    else log(`Unexpected status: ${resp.status}`);
    return { valid: false, debug: lines.join('\n') };
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
    const csrfResp = await axios.post('https://auth.roblox.com/v2/session/refresh', {}, {
      headers: baseHeaders,
      validateStatus: () => true,
    });
    log(`Status: ${csrfResp.status}`);
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) {
        log('Cookie expired or invalid');
        return { newCookie: null, status: 'COOKIE_EXPIRED', debug: lines.join('\n') };
      }
      log(`No CSRF token (${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: lines.join('\n') };
    }
    log(`CSRF: ${csrf.slice(0, 20)}…`);
    log('POST /v2/session/refresh (with CSRF)');
    const refreshResp = await axios.post('https://auth.roblox.com/v2/session/refresh', {}, {
      headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf },
      validateStatus: () => true,
    });
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
        log(`New cookie: ${newCookie.slice(0, 10)}…`);
        return { newCookie, status: 'SUCCESS', debug: lines.join('\n') };
      }
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
    const csrfResp = await axios.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, {
      headers: baseHeaders,
      validateStatus: () => true,
    });
    log(`Status: ${csrfResp.status}`);
    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      if (csrfResp.status === 401) {
        log('Cookie expired or invalid');
        return { newCookie: null, status: 'COOKIE_EXPIRED', debug: lines.join('\n') };
      }
      log(`No CSRF token (${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: lines.join('\n') };
    }
    log(`CSRF: ${csrf.slice(0, 20)}…`);
    log('POST /v2/logoutfromallsessionsandreauthenticate (with CSRF)');
    const resetResp = await axios.post('https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate', {}, {
      headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrf },
      validateStatus: () => true,
    });
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
        log(`New cookie: ${newCookie.slice(0, 10)}…`);
        return { newCookie, status: 'SUCCESS', debug: lines.join('\n') };
      }
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
