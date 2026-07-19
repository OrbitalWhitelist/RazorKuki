import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export interface ValidateResult {
  valid: boolean;
  username?: string;
  displayName?: string;
  userId?: number;
  debug: string;
}

/**
 * Validates a Roblox .ROBLOSECURITY cookie WITHOUT modifying the session.
 * Uses a plain GET request — no CSRF required, no side effects, cannot invalidate the cookie.
 */
export async function validateCookie(cookie: string): Promise<ValidateResult> {
  const lines: string[] = [];
  const log = (msg: string) => lines.push(msg);

  log(`📥 Cookie length: ${cookie.length}`);

  try {
    log('📤 GET https://users.roblox.com/v1/users/authenticated …');
    const resp = await axios.get('https://users.roblox.com/v1/users/authenticated', {
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie.trim()}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: () => true,
    });

    log(`↩️  Status: ${resp.status}`);

    if (resp.status === 200) {
      const { id, name, displayName } = resp.data as { id: number; name: string; displayName: string };
      log(`✅ Authenticated as: ${name} (${displayName}) — ID ${id}`);
      return { valid: true, username: name, displayName, userId: id, debug: lines.join('\n') };
    }

    if (resp.status === 401) {
      log('❌ Cookie is invalid or expired (401 Unauthorized)');
    } else {
      log(`⚠️  Unexpected status ${resp.status}`);
      log(`📄 Body: ${JSON.stringify(resp.data)}`);
    }

    return { valid: false, debug: lines.join('\n') };
  } catch (err: any) {
    log(`💥 Network error: ${err.message}`);
    return { valid: false, debug: lines.join('\n') };
  }
}

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string;
}

/**
 * Refreshes a Roblox .ROBLOSECURITY cookie.
 *
 * Flow:
 *   1. POST /v2/logout WITHOUT a CSRF token
 *      → Roblox rejects with 403/401 but returns x-csrf-token in the header.
 *        The session is NOT invalidated because the request was rejected.
 *   2. POST /v2/logoutfromallsessionsandreauthenticate WITH that CSRF token
 *      → Roblox logs out all sessions and sets a brand-new .ROBLOSECURITY cookie.
 */
export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const lines: string[] = [];
  const log = (msg: string) => lines.push(msg);

  log(`📥 Cookie length: ${cookie.length}`);

  const jar = new CookieJar();
  await jar.setCookie(`.ROBLOSECURITY=${cookie.trim()}`, 'https://auth.roblox.com');
  log('✅ Cookie set in jar');

  const client = wrapper(
    axios.create({
      baseURL: 'https://auth.roblox.com',
      jar,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: () => true,
    })
  );

  try {
    // STEP 1 — POST /v2/logout without CSRF to harvest the token
    // Expected: 403 (or 401 if cookie is already expired) + x-csrf-token header
    // The session is NOT logged out because the request is rejected by Roblox
    log('📤 POST /v2/logout (no CSRF — expecting 403/401 + x-csrf-token)…');
    const csrfResp = await client.post('/v2/logout');
    log(`↩️  /v2/logout → status ${csrfResp.status}`);

    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      log(`❌ No x-csrf-token header (status ${csrfResp.status})`);
      log(`📋 Response headers: ${JSON.stringify(csrfResp.headers)}`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: lines.join('\n') };
    }
    log(`🔑 CSRF obtained: ${csrf.slice(0, 20)}…`);

    // STEP 2 — re-auth with CSRF; Roblox invalidates all sessions and issues a new cookie
    log('📤 POST /v2/logoutfromallsessionsandreauthenticate (with CSRF)…');
    const reauthResp = await client.post(
      '/v2/logoutfromallsessionsandreauthenticate',
      {},
      { headers: { 'X-CSRF-TOKEN': csrf } }
    );
    log(`↩️  Re-auth → status ${reauthResp.status}`);

    if (reauthResp.status === 200) {
      const trimmed = cookie.trim();

      // Try jar first — pick the cookie whose value differs from the original
      const cookies = await jar.getCookies('https://auth.roblox.com');
      log(`🍪 Jar has ${cookies.length} cookie(s)`);
      const newFromJar = cookies
        .filter(c => c.key === '.ROBLOSECURITY' && c.value !== trimmed)
        .pop();

      if (newFromJar) {
        log(`✅ New cookie from jar: ${newFromJar.value.slice(0, 10)}…`);
        return { newCookie: newFromJar.value, status: 'SUCCESS', debug: lines.join('\n') };
      }

      // Fallback — parse Set-Cookie headers directly
      const setCookie = reauthResp.headers['set-cookie'];
      log(`📋 Set-Cookie: ${JSON.stringify(setCookie)}`);
      if (Array.isArray(setCookie)) {
        for (const raw of setCookie) {
          const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match && match[1] !== trimmed) {
            log(`✅ New cookie from Set-Cookie header: ${match[1].slice(0, 10)}…`);
            return { newCookie: match[1], status: 'SUCCESS', debug: lines.join('\n') };
          }
        }
      }

      log('⚠️  Re-auth returned 200 but no new .ROBLOSECURITY found');
      return { newCookie: null, status: 'SUCCESS_NO_COOKIE', debug: lines.join('\n') };
    }

    log(`❌ Re-auth failed with status ${reauthResp.status}`);
    if (reauthResp.data) {
      log(`📄 Response body: ${JSON.stringify(reauthResp.data)}`);
    }
    return { newCookie: null, status: `ERROR_${reauthResp.status}`, debug: lines.join('\n') };
  } catch (err: any) {
    log(`💥 Network error: ${err.message}`);
    return { newCookie: null, status: `NETWORK_ERROR_${err.message}`, debug: lines.join('\n') };
  }
}
