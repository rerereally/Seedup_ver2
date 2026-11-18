import type { SupabaseClient } from '@supabase/supabase-js';

type Dated = { user_id: string | null; created_at: string };
export type FunnelRows = {
  onboarding: Dated[];
  scraps: Dated[];
  prdRuns: Array<Dated & { ok: boolean; kind: string; duration_ms: number | null }>;
  dossiers: Dated[];
  tokens: Array<Dated & { last_used_at: string | null }>;
  usage: Array<{ user_id: string; usage_date: string }>;
};

export type Funnel = {
  signedUp: number;
  active: number;
  returning: number;
  kept: number;
  prdMade: number;
  prdSaved: number;
  agentUsed: number;
  agentConnected: number;
  prdRuns: number;
  prdSuccessRate: number | null;
  prdMedianSeconds: number | null;
};

const users = (rows: Array<{ user_id: string | null }>) => new Set(rows.flatMap((row) => (row.user_id ? [row.user_id] : [])));

/**
 * How many people reached each step in a window, read from tables the site already writes (no event tracking):
 * signed up, kept something, made a PRD, saved one, used their agent, and came back on a second day.
 */
export function usageFunnel(rows: FunnelRows, since: string): Funnel {
  const inWindow = <T extends { created_at: string }>(list: T[]) => list.filter((row) => row.created_at >= since);
  const scraps = inWindow(rows.scraps);
  const prdRuns = inWindow(rows.prdRuns).filter((row) => row.kind === 'prd');
  const okRuns = prdRuns.filter((row) => row.ok);
  const dossiers = inWindow(rows.dossiers);
  const agentUsed = rows.tokens.filter((row) => row.last_used_at && row.last_used_at >= since);
  const sinceDay = since.slice(0, 10);

  // A person is active on a day when they kept, generated or used a counted feature that day.
  const days = new Map<string, Set<string>>();
  const mark = (user: string | null, day: string) => {
    if (!user) return;
    days.set(user, (days.get(user) ?? new Set()).add(day));
  };
  for (const row of [...scraps, ...inWindow(rows.prdRuns), ...dossiers]) mark(row.user_id, row.created_at.slice(0, 10));
  for (const row of rows.usage) if (row.usage_date >= sinceDay) mark(row.user_id, row.usage_date);
  for (const row of agentUsed) mark(row.user_id, String(row.last_used_at).slice(0, 10));

  const durations = okRuns.flatMap((row) => (row.duration_ms ? [row.duration_ms] : [])).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor((durations.length - 1) / 2)] : null;
  return {
    signedUp: users(inWindow(rows.onboarding)).size,
    active: days.size,
    returning: [...days.values()].filter((set) => set.size >= 2).length,
    kept: users(scraps).size,
    prdMade: users(okRuns).size,
    prdSaved: users(dossiers).size,
    agentUsed: users(agentUsed).size,
    agentConnected: rows.tokens.length,
    prdRuns: prdRuns.length,
    prdSuccessRate: prdRuns.length ? Math.round((okRuns.length / prdRuns.length) * 100) : null,
    prdMedianSeconds: median === null ? null : Math.round(median / 1000),
  };
}

/** The last 7 and 30 days side by side, for the admin page. */
export function recentFunnels(rows: FunnelRows, now = Date.now()) {
  return ([[7, '최근 7일'], [30, '최근 30일']] as const).map(([days, label]) => ({ label, funnel: usageFunnel(rows, new Date(now - days * 86_400_000).toISOString()) }));
}

/** The last 30 days of the rows `usageFunnel` reads. A table that is missing reads as empty. */
export async function loadFunnelRows(service: SupabaseClient | null, days = 30): Promise<FunnelRows> {
  const empty: FunnelRows = { onboarding: [], scraps: [], prdRuns: [], dossiers: [], tokens: [], usage: [] };
  if (!service) return empty;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const read = async <T>(query: PromiseLike<{ data: unknown; error: unknown }>) => {
    const { data, error } = await query;
    return error ? [] : ((data ?? []) as T[]);
  };
  const [onboarding, scraps, prdRuns, dossiers, tokens, usage] = await Promise.all([
    read<Dated>(service.from('user_onboarding').select('user_id,created_at').gte('created_at', since).limit(10000)),
    read<Dated>(service.from('scraps').select('user_id,created_at').gte('created_at', since).limit(10000)),
    read<FunnelRows['prdRuns'][number]>(service.from('prd_runs').select('user_id,created_at,ok,kind,duration_ms').gte('created_at', since).limit(10000)),
    read<Dated>(service.from('evidence_dossiers').select('user_id,created_at').gte('created_at', since).limit(10000)),
    read<FunnelRows['tokens'][number]>(service.from('mcp_tokens').select('user_id,created_at,last_used_at').limit(10000)),
    read<FunnelRows['usage'][number]>(service.from('ai_usage').select('user_id,usage_date').gte('usage_date', since.slice(0, 10)).limit(10000)),
  ]);
  return { onboarding, scraps, prdRuns, dossiers, tokens, usage };
}
