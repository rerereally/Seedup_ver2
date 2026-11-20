/** Period rankings for the explore tabs: what rose most over a day, a week, a month or a year. Pure, so it is tested alone. */

export const PERIODS = [
  { key: '1d', days: 1, label: '1일' },
  { key: '1w', days: 7, label: '1주' },
  { key: '1m', days: 30, label: '1달' },
  { key: '1y', days: 365, label: '1년' },
] as const;

export type Period = (typeof PERIODS)[number];
export type PeriodKey = Period['key'];
export type PeriodState = { period: Period | null; ready: Record<PeriodKey, boolean>; historyDays: number };

const DAY_MS = 86_400_000;

export const periodOf = (value?: string | null) => PERIODS.find((period) => period.key === value) ?? null;

/** The calendar day `days` before `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export const daysBefore = (date: string, days: number) => new Date(Date.parse(date.slice(0, 10)) - days * DAY_MS).toISOString().slice(0, 10);

export const historyDays = (oldest: string | null, newest: string | null) => (oldest && newest ? Math.max(0, Math.round((Date.parse(newest.slice(0, 10)) - Date.parse(oldest.slice(0, 10))) / DAY_MS)) : 0);

/** A period is offered only once the stored history reaches back that far; otherwise it would rank the same as "all". */
export function periodState(requested: string | null | undefined, oldest: string | null, newest: string | null): PeriodState {
  const days = historyDays(oldest, newest);
  const ready = Object.fromEntries(PERIODS.map((period) => [period.key, days >= period.days])) as Record<PeriodKey, boolean>;
  const period = periodOf(requested);
  return { period: period && ready[period.key] ? period : null, ready, historyDays: days };
}

/** How many days before the baseline day a snapshot may be and still stand for it (collection skips days now and then). */
export const baselineSlack = (days: number) => (days <= 1 ? 2 : days <= 7 ? 3 : 7);

/** Each key's value on `date`: the latest row on or before it. */
export function valuesAt(rows: Array<{ key: string; date: string; value: number }>, date: string) {
  const latest = new Map<string, { date: string; value: number }>();
  for (const row of rows) {
    if (row.date > date) continue;
    const seen = latest.get(row.key);
    if (!seen || row.date > seen.date) latest.set(row.key, row);
  }
  return new Map([...latest].map(([key, row]) => [key, row.value]));
}

/**
 * Orders items by how much their value rose since the baseline, the larger current value first on ties.
 * `newCounts`: an item with no baseline appeared during the period, so its whole value is the rise (a trend topic).
 * Without it such an item is left out, since its rise is unknown (a repo first tracked mid-period).
 */
export function rankByRise<T>(items: T[], now: (item: T) => number, key: (item: T) => string, before: Map<string, number>, newCounts: boolean) {
  return items
    .flatMap((item) => {
      const base = before.get(key(item));
      if (base === undefined && !newCounts) return [];
      return [{ item, rise: now(item) - (base ?? 0) }];
    })
    .sort((left, right) => right.rise - left.rise || now(right.item) - now(left.item));
}

/** Whether a date falls inside the last `days` days before `now`. */
export const withinDays = (date: string | null | undefined, days: number, now = Date.now()) => {
  const at = date ? Date.parse(date) : Number.NaN;
  return Number.isFinite(at) && at <= now && now - at <= days * DAY_MS;
};

/** Reader interest in one AI product: views, likes against dislikes, and star ratings weighted by how many there are. */
export function productPopularity(product: { view_count?: number | null; like_count?: number | null; dislike_count?: number | null; rating_count?: number | null; user_rating_average?: number | null }) {
  const ratings = Number(product.rating_count ?? 0);
  const average = Number(product.user_rating_average ?? 0);
  return Number(product.view_count ?? 0) + 5 * (Number(product.like_count ?? 0) - Number(product.dislike_count ?? 0)) + (ratings ? 4 * ratings * (average - 2.5) : 0);
}

/**
 * Each key's average value per recorded day. A day the key is missing counts as 0, so a topic that stayed popular all
 * period beats one that spiked once.
 */
export function averagePerDay(rows: Array<{ key: string; date: string; value: number }>) {
  const days = new Set(rows.map((row) => row.date)).size;
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.key, (sums.get(row.key) ?? 0) + row.value);
  return new Map([...sums].map(([key, sum]) => [key, days ? sum / days : 0]));
}

/** Rise as a share of where it started (0.5 = +50%); unknown when it started at nothing. */
export const growthRate = (rise: number, base: number) => (base > 0 ? rise / base : null);

/**
 * One overall model ranking from usage and performance. Each ranking is the top `size`, so a place is worth
 * (size + 1 - rank) / size points and being off a list is worth 0. Performance leans on the intelligence index; the
 * design arena only measures front-end work, so it counts for less.
 */
export function modelComposite<T extends { popularity_rank: number | null; intelligence_rank: number | null; arena_rank: number | null }>(models: T[], size = 20) {
  const points = (rank: number | null) => (rank ? Math.max(0, (size + 1 - rank) / size) : 0);
  return models
    .map((model) => {
      const usage = points(model.popularity_rank);
      const performance = 0.7 * points(model.intelligence_rank) + 0.3 * points(model.arena_rank);
      return { model, usage, performance, score: Math.round(100 * (usage + performance) / 2) };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || right.usage - left.usage);
}
