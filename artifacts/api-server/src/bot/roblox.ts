import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export interface RefreshResult {
  newCookie: string | null;
  status: string;
  debug: string[];
}

/**
 * Refreshes a Roblox .ROBLOSECURITY cookie.
 * Uses axios + tough-cookie so the cookie jar is maintained across both
 * requests exactly like Python's requests.Session does.
 */
export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const debug: string[] = [];
  debug.push(`📥 Cookie received (length: ${cookie.length})`);

  const jar = new CookieJar();
  await jar.setCookie(`.ROBLOSECURITY=${cookie.trim()}`, "https://auth.roblox.com");
  debug.push("✅ Cookie loaded into jar");

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
      // Don't throw on non-2xx so we can read the status ourselves
      validateStatus: () => true,
    }),
  );

  try {
    // STEP 1 — POST /v2/logout to obtain CSRF token
    debug.push("📤 POST /v2/logout ...");
    const csrfResp = await client.post("/v2/logout");
    debug.push(`↩️  /v2/logout → status ${csrfResp.status}`);

    const csrf = csrfResp.headers["x-csrf-token"] as string | undefined;
    if (!csrf) {
      debug.push(`❌ CSRF token missing (status ${csrfResp.status})`);
      return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}`, debug };
    }
    debug.push(`🔑 CSRF token: ${csrf.slice(0, 20)}…`);

    // STEP 2 — logout from all sessions and get a fresh cookie
    debug.push("📤 POST /v2/logoutfromallsessionsandreauthenticate ...");
    const reauthResp = await client.post(
      "/v2/logoutfromallsessionsandreauthenticate",
      {},
      { headers: { "X-CSRF-TOKEN": csrf } },
    );
    debug.push(`↩️  Re-auth → status ${reauthResp.status}`);

    if (reauthResp.status === 200) {
      // Try the cookie jar first — axios-cookiejar-support stores Set-Cookie automatically
      const cookies = await jar.getCookies("https://auth.roblox.com");
      debug.push(`🍪 Jar has ${cookies.length} cookie(s)`);
      const robloxCookie = cookies.find((c) => c.key === ".ROBLOSECURITY");

      if (robloxCookie) {
        debug.push(`✅ New cookie from jar: ${robloxCookie.value.slice(0, 10)}…`);
        return { newCookie: robloxCookie.value, status: "SUCCESS", debug };
      }

      // Fallback — parse Set-Cookie headers directly
      const setCookie = reauthResp.headers["set-cookie"];
      debug.push(`📋 Raw Set-Cookie: ${JSON.stringify(setCookie)}`);
      if (Array.isArray(setCookie)) {
        for (const raw of setCookie) {
          const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match) {
            debug.push(`✅ New cookie from header: ${match[1].slice(0, 10)}…`);
            return { newCookie: match[1], status: "SUCCESS", debug };
          }
        }
      }

      debug.push("⚠️  No .ROBLOSECURITY found in response");
      return { newCookie: null, status: "SUCCESS_NO_COOKIE", debug };
    }

    debug.push(`❌ Re-auth failed with status ${reauthResp.status}`);
    return { newCookie: null, status: `ERROR_${reauthResp.status}`, debug };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    debug.push(`💥 Exception: ${message}`);
    const axiosErr = err as { response?: { data?: unknown } };
    if (axiosErr.response?.data) {
      debug.push(`📄 Response data: ${JSON.stringify(axiosErr.response.data)}`);
    }
    return { newCookie: null, status: `EXCEPTION_${message}`, debug };
  }
}
