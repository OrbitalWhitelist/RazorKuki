const cooldowns = new Map<string, number>();

export function checkCooldown(userId: string, cooldownMs: number): { allowed: boolean; remainingSeconds: number } {
  const lastUsed = cooldowns.get(userId);
  const now = Date.now();
  if (lastUsed) {
    const elapsed = now - lastUsed;
    if (elapsed < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
      return { allowed: false, remainingSeconds };
    }
  }
  cooldowns.set(userId, now);
  return { allowed: true, remainingSeconds: 0 };
}