export interface RefreshResult {
  newCookie: string | null;
  status: "SUCCESS" | "SUCCESS_NO_COOKIE" | string;
}

export interface CheckResult {
  valid: boolean;
  username?: string;
  userId?: number;
}

/**
 * Refreshes a Roblox .ROBLOSECURITY cookie by calling the reauthenticate endpoint.
 * Ported from the original Python implementation.
 */
export async function refreshCookie(cookie: string): Promise<RefreshResult> {
  const cookieHeader = `.ROBLOSECURITY=${cookie}`;

  // Step 1: Hit the logout endpoint to get a CSRF token
  const csrfResp = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });

  const csrf = csrfResp.headers.get("x-csrf-token");
  if (!csrf) {
    return { newCookie: null, status: `CSRF_FAILED_${csrfResp.status}` };
  }

  // Step 2: Logout from all sessions and reauthenticate to receive a new cookie
  const resp = await fetch(
    "https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate",
    {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "X-CSRF-TOKEN": csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  if (resp.status === 200) {
    const setCookie = resp.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/\.ROBLOSECURITY=([^;]+)/);
    if (match) {
      return { newCookie: match[1], status: "SUCCESS" };
    }
    return { newCookie: null, status: "SUCCESS_NO_COOKIE" };
  }

  return { newCookie: null, status: `ERROR_${resp.status}` };
}

/**
 * Checks whether a .ROBLOSECURITY cookie is still valid by calling
 * the authenticated users endpoint.
 */
export async function checkCookie(cookie: string): Promise<CheckResult> {
  const resp = await fetch("https://users.roblox.com/v1/users/authenticated", {
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    },
  });

  if (resp.status === 200) {
    const data = (await resp.json()) as { name: string; id: number };
    return { valid: true, username: data.name, userId: data.id };
  }

  return { valid: false };
}

/**
 * Masks a cookie for safe display — shows first 15 and last 6 chars only.
 */
export function maskCookie(cookie: string): string {
  if (cookie.length <= 24) return "***";
  return `${cookie.slice(0, 15)}...${cookie.slice(-6)}`;
}
