import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const HOSTS = [
  { host: 'users.roblox.com', ip: '104.18.2.63' },
  { host: 'users.roblox.com', ip: null }, // fallback to domain
];

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

  const trimmed = rawCookie.trim();

  // Try each host (IP first, then domain)
  for (const entry of HOSTS) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const jar = new CookieJar();
        await jar.setCookie(`.ROBLOSECURITY=${trimmed}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
        const client = wrapper(axios.create({ jar }));

        const url = entry.ip
          ? `https://${entry.ip}/v1/users/authenticated`
          : `https://${entry.host}/v1/users/authenticated`;

        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': `.ROBLOSECURITY=${trimmed}`,
        };
        if (entry.ip) {
          headers['Host'] = entry.host;
        }

        const resp = await client.get(url, {
          headers,
          validateStatus: () => true,
          timeout: 20000, // 20 seconds
        });

        log(`Attempt ${attempt} (${entry.ip || entry.host}): status ${resp.status}`);
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
          // Continue to next attempt/host
        }
      } catch (err: any) {
        log(`Attempt ${attempt} (${entry.ip || entry.host}) error: ${err.message}`);
        if (attempt === maxAttempts) {
          // Move to next host
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // If we've exhausted all hosts and attempts
  return {
    valid: false,
    debug: debugLines.join('\n'),
    isNetworkError: true,
  };
}