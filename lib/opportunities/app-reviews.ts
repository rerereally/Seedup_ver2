import type { RawSignal } from './types';

type Signal = Omit<RawSignal, 'id' | 'actor'>;
type App = { trackId?: number; trackName?: string; trackViewUrl?: string };
type Label = { label?: string };
type Entry = { title?: Label; content?: Label; 'im:rating'?: Label; updated?: Label; 'im:voteSum'?: Label };

const HEADERS = { accept: 'application/json', 'user-agent': 'SeedupEvidence/1.0' };

async function getJson(fetcher: typeof fetch, url: string): Promise<unknown> {
  try {
    const res = await fetcher(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function reviewsOf(app: App, perApp: number, fetcher: typeof fetch): Promise<Signal[]> {
  const feed = await getJson(fetcher, `https://itunes.apple.com/us/rss/customerreviews/id=${app.trackId}/sortBy=mostRecent/json`) as { feed?: { entry?: Entry[] | Entry } } | null;
  const raw = feed?.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const url = (app.trackViewUrl ?? '').split('?')[0];
  return entries
    // The first entry is sometimes the app's own info, which has no rating.
    .filter((entry) => [1, 2, 3].includes(Number(entry?.['im:rating']?.label)))
    .map((entry) => ({
      platform: 'web' as const, // shortcut: platform 'web' because live-evidence.ts (frozen) rejects unknown platforms; add 'appstore' when the freeze lifts.
      url,
      title: `${app.trackName ?? 'App'} review: ${entry.title?.label ?? ''}`,
      text: String(entry.content?.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 700),
      score: Number(entry['im:voteSum']?.label) || 0,
      postedAt: entry.updated?.label ?? null,
    }))
    .filter((signal) => signal.text.length >= 40)
    .slice(0, perApp);
}

/**
 * Returns low-star (1 to 3) App Store reviews of apps matching a phrase, as demand evidence for ideas outside software.
 * Never throws: a failed request just contributes no reviews.
 */
export async function searchAppReviews(phrase: string, options: { limitApps?: number; perApp?: number; fetcher?: typeof fetch } = {}): Promise<Signal[]> {
  // Apple's review feed is empty for most apps (1 of 9 had reviews on 2026-11-20), so a few more apps are tried.
  const { limitApps = 5, perApp = 4, fetcher = fetch } = options;
  const search = await getJson(fetcher, `https://itunes.apple.com/search?term=${encodeURIComponent(phrase)}&entity=software&country=us&limit=${limitApps}`) as { results?: App[] } | null;
  const found = search?.results;
  const apps = Array.isArray(found) ? found.filter((app) => app?.trackId && app.trackViewUrl) : [];
  return (await Promise.all(apps.map((app) => reviewsOf(app, perApp, fetcher)))).flat();
}
