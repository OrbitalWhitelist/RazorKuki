import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string;
}

/**
 * Refreshes a Roblox .ROBLOSECURITY cookie.
 *
 * Flow:
 *   1. POST /v2/logoutfromallsessionsandreauthenticate without CSRF
 *      → Roblox returns 403 + x-csrf-token header (session is still alive)
 *   2. POST the same endpoint again WITH the CSRF token
 *      → Roblox logs out all sessions, issues a brand-new .ROBLOSECURITY cookie
 *
 * We intentionally never call /v2/logout because that invalidates the cookie
 * before we can use it for the re-auth step.
 */
export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const lines: string[] = [];
  const log = (msg: string) => lines.push(msg);
  const buildDebug = () => lines.join("\n");

  log(`📥 Cookie received (length: ${cookie.length})`);

  const jar = new CookieJar();
  await jar.setCookie(
    `.ROBLOSECURITY=${cookie.trim()}`,
    "https://auth.roblox.com",
  );
  log("✅ Cookie loaded into jar");

  const client = wrapper(
    axios.create({
      baseURL: "https://auth.roblox.com",
      jar,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: () => true,
    }),
  );

  try {
    // STEP 1 — hit the reauth endpoint without a CSRF token to harvest it
    // Roblox returns 403 + x-csrf-token; the cookie stays valid
    log("📤 POST /v2/logoutfromallsessionsandreauthenticate (no CSRF, expecting 403)…");
    const csrfResp = await client.post(
      "/v2/logoutfromallsessionsandreauthenticate",
      {},
    );
    log(`↩️  Status: ${csrfResp.status}`);

    const csrf = csrfResp.headers["x-csrf-token"] as string | undefined;
    if (!csrf) {
      log(`❌ x-csrf-token header not present (status ${csrfResp.status})`);
      log(`📋 Response headers: ${JSON.stringify(csrfResp.headers)}`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug: buildDebug() };
    }
    log(`🔑 CSRF token obtained: ${csrf.slice(0, 20)}…`);

    // STEP 2 — re-auth with the CSRF token; this invalidates all sessions
    // and the response sets a fresh .ROBLOSECURITY cookie
    log("📤 POST /v2/logoutfromallsessionsandreauthenticate (with CSRF)…");
    const reauthResp = await client.post(
      "/v2/logoutfromallsessionsandreauthenticate",
      {},
      { headers: { "X-CSRF-TOKEN": csrf } },
    );
    log(`↩️  Re-auth status: ${reauthResp.status}`);

    if (reauthResp.status === 200) {
      // Try the jar first — axios-cookiejar-support captures Set-Cookie automatically
      const allCookies = await jar.getCookies("https://auth.roblox.com");
      log(`🍪 Jar has ${allCookies.length} cookie(s) after re-auth`);

      // The jar will still contain the OLD cookie plus potentially the new one.
      // getCookies returns the most-recently-set cookie last, so we look for
      // one whose value differs from what was passed in.
      const trimmed = cookie.trim();
      const newCookieFromJar = allCookies
        .filter((c) => c.key === ".ROBLOSECURITY" && c.value !== trimmed)
        .pop();

      if (newCookieFromJar) {
        log(`✅ New cookie extracted from jar: ${newCookieFromJar.value.slice(0, 10)}…`);
        return { newCookie: newCookieFromJar.value, status: "SUCCESS", debug: buildDebug() };
      }

      // Fallback — parse Set-Cookie response headers directly
      const setCookie = reauthResp.headers["set-cookie"];
      log(`📋 Raw Set-Cookie header: ${JSON.stringify(setCookie)}`);
      if (Array.isArray(setCookie)) {
        for (const raw of setCookie) {
          const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match && match[1] !== trimmed) {
            log(`✅ New cookie extracted from Set-Cookie header: ${match[1].slice(0, 10)}…`);
            return { newCookie: match[1], status: "SUCCESS", debug: buildDebug() };
          }
        }
      }

      log("⚠️  Re-auth returned 200 but no new .ROBLOSECURITY cookie found");
      return { newCookie: null, status: "SUCCESS_NO_COOKIE", debug: buildDebug() };
    }

    log(`❌ Re-auth returned unexpected status ${reauthResp.status}`);
    if (reauthResp.data) {
      log(`📄 Response body: ${JSON.stringify(reauthResp.data)}`);
    }
    return { newCookie: null, status: `ERROR_${reauthResp.status}`, debug: buildDebug() };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log(`💥 Exception: ${message}`);
    return { newCookie: null, status: `EXCEPTION_${message}`, debug: buildDebug() };
  }
}
