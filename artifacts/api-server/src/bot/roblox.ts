import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string; // single merged string, not an array
}

/**
 * Refreshes a Roblox .ROBLOSECURITY cookie.
 *
 * Flow:
 *   1. POST /v2/logoutfromallsessionsandreauthenticate WITHOUT a CSRF token
 *      → Roblox returns 403 + x-csrf-token header (session stays alive)
 *   2. POST the same endpoint again WITH the token
 *      → Roblox invalidates all sessions and sets a brand-new .ROBLOSECURITY cookie
 *
 * We never call /v2/logout — that endpoint actually logs the account out,
 * killing the cookie before Step 2 can use it.
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
      validateStatus: () => true,  // don't throw on 4xx/5xx
    })
  );

  try {
    // STEP 1 — hit the reauth endpoint without CSRF to harvest the token
    // Roblox will return 403 + x-csrf-token; the session/cookie is still valid
    log('📤 POST /v2/logoutfromallsessionsandreauthenticate (no CSRF, expecting 403)…');
    const csrfResp = await client.post('/v2/logoutfromallsessionsandreauthenticate', {});
    log(`↩️  Status: ${csrfResp.status}`);

    const csrf = csrfResp.headers['x-csrf-token'] as string | undefined;
    if (!csrf) {
      log(`❌ No CSRF token in response (status ${csrfResp.status})`);
      log(`📋 Headers: ${JSON.stringify(csrfResp.headers)}`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: lines.join('\n') };
    }
    log(`🔑 CSRF obtained: ${csrf.slice(0, 20)}…`);

    // STEP 2 — re-auth with CSRF; Roblox logs out all sessions and issues a new cookie
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

      // Fallback: parse Set-Cookie headers directly
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
