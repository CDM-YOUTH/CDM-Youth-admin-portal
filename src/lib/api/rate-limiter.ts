// Sliding-window rate limiter keyed by userId (JWT sub).
// In-memory — resets on server restart. Suitable for single-instance deployments;
// for multi-instance edge deploys consider replacing the store with Upstash Redis.

const store = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

// Prune stale entries opportunistically — no global setInterval (banned in Cloudflare Workers).
let _lastPrune = 0;
const PRUNE_EVERY = 5 * 60_000;

const maybePrune = (now: number) => {
  if (now - _lastPrune < PRUNE_EVERY) return;
  _lastPrune = now;
  const cutoff = now - WINDOW_MS;
  for (const [k, v] of store.entries()) {
    if (v.windowStart < cutoff) store.delete(k);
  }
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  maybePrune(now);
  const entry = store.get(userId);

  if (!entry || now >= entry.windowStart + WINDOW_MS) {
    store.set(userId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}
