interface StoredCookie {
  cookie: string;
  expiresAt: number | null;
}

const store = new Map<string, StoredCookie>();

export function storeCookie(id: string, cookie: string, deliveredViaDM: boolean): void {
  const expiresAt = deliveredViaDM ? Date.now() + 20 * 60 * 1000 : null;
  store.set(id, { cookie, expiresAt });

  if (expiresAt !== null) {
    setTimeout(() => {
      const entry = store.get(id);
      if (entry && entry.expiresAt === expiresAt) store.delete(id);
    }, 20 * 60 * 1000 + 1000);
  }
}

export function getCookie(id: string): string | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    store.delete(id);
    return null;
  }
  return entry.cookie;
}