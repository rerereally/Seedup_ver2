import { getCloudflareContext } from '@opennextjs/cloudflare';

// Requests per minute per visitor, for the routes that call free models or count views. On Cloudflare each limit is a
// Rate Limiting binding (wrangler.jsonc "ratelimits", named RL_<per minute>), counted across Worker instances in the
// visitor's Cloudflare location. Without a binding (local dev, tests, a limit with no binding) it falls back to this
// instance's memory, which only blunts bursts. Daily limits live in the database (usage-limit.ts).
const recent = new Map<string, number[]>();

type Limiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

/** The client's address as Cloudflare or a proxy reports it. */
export const clientOf = (request: Request) => request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

function limiterFor(perMinute: number): Limiter | null {
  try {
    const binding = (getCloudflareContext().env as unknown as Record<string, unknown>)[`RL_${perMinute}`] as Limiter | undefined;
    return typeof binding?.limit === 'function' ? binding : null;
  } catch {
    return null;
  }
}

function countInMemory(key: string, perMinute: number) {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((time) => now - time < 60_000);
  if (times.length >= perMinute) return true;
  times.push(now);
  recent.set(key, times);
  if (recent.size > 2_000) recent.clear();
  return false;
}

/**
 * True when `key` already made `perMinute` requests in the last minute; otherwise counts this one. Both counts apply:
 * the binding is shared across instances but approximate by design (a quick burst gets through before it syncs),
 * and this instance's exact count catches the burst.
 */
export async function rateLimited(key: string, perMinute: number, limiter: Limiter | null = limiterFor(perMinute)) {
  const local = countInMemory(key, perMinute);
  if (local || !limiter) return local;
  try {
    return !(await limiter.limit({ key })).success;
  } catch {
    // A limiter outage must not block visitors; this instance's count already applied.
    return false;
  }
}
