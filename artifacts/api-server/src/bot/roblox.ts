import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import dns from 'dns/promises';

const FALLBACK_IPS: Record<string, string> = {
  'users.roblox.com': '104.18.2.63',
};

let dnsCache: Record<string, string> = {};

async function resolveDomain(domain: string): Promise<string> {
  if (dnsCache[domain]) return dnsCache[domain];
  try {
    const ip = await dns.lookup(domain).then(res => res.address);
    dnsCache[domain] = ip;
    return ip;
  } catch {
    const fallback = FALLBACK_IPS[domain];
    if (fallback) {
      dnsCache[domain] = fallback;
      return fallback;
    }
    throw new Error(`Could not resolve ${domain}`);
  }
}

export async function validateCookie(cookie: string, maxAttempts = 3): Promise<{ valid: boolean; userId?: number; username?: string; displayName?: string; debug: string }> {
  const debugLines: string[] = [];
  const log = (msg: string) => debugLines.push(msg);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const trimmed = cookie.trim();
      const jar = new CookieJar();
      await jar.setCookie(`.ROBLOSECURITY=${trimmed}; Domain=.roblox.com; Path=/`, 'https://users.roblox.com');
      const client = wrapper(axios.create({ jar }));

      let ip: string;
      try {
        ip = await resolveDomain('users.roblox.com');
      } catch {
        ip = 'users.roblox.com';
      }
      const url = `https://${ip}/v1/users/authenticated`;
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
        };
      }
      if (resp.status === 401) {
        log('Cookie invalid (401)');
        return { valid: false, debug: debugLines.join('\n') };
      }
    } catch (err: any) {
      log(`Attempt ${attempt} error: ${err.message}`);
      if (attempt === maxAttempts) {
        return { valid: false, debug: debugLines.join('\n') };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return { valid: false, debug: debugLines.join('\n') };
}