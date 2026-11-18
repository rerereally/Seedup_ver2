// Per-instance, best effort: keeps one visitor from burning a free quota (embeddings, model calls). Workers restart
// often and do not share memory, so this only blunts bursts; daily limits live in the database (usage-limit.ts).
const recent = new Map<string, number[]>();

/** The client's address as Cloudflare or a proxy reports it. */
export const clientOf = (request: Request) => request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

/** True when `key` already made `perMinute` requests in the last minute; otherwise counts this one. */
export function rateLimited(key: string, perMinute: number) {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((time) => now - time < 60_000);
  if (times.length >= perMinute) return true;
  times.push(now);
  recent.set(key, times);
  if (recent.size > 2_000) recent.clear();
  return false;
}
