// Reads the run log as "is each source still alive", which the per-run table cannot show at a glance.

export type HealthRun = { source: string; status: string; created_at: string; error_count?: number | null; detail?: Record<string, unknown> | null };
export type SourceState = 'ok' | 'unstable' | 'failing' | 'stale';
export type SourceHealth = { source: string; state: SourceState; runs: number; failures: number; lastRunAt: string; lastStatus: string; lastSuccessAt: string | null };
export type ActorHealth = { id: string; status: string; items: number; errors: number };

const STALE_AFTER_HOURS = 48;
const STATE_RANK: Record<SourceState, number> = { failing: 0, stale: 1, unstable: 2, ok: 3 };

/** One row per source, worst first. Runs may come in any order. */
export function summarizeSourceHealth(runs: HealthRun[], now = Date.now()): SourceHealth[] {
  const bySource = new Map<string, HealthRun[]>();
  for (const run of runs) bySource.set(run.source, [...(bySource.get(run.source) ?? []), run]);

  return [...bySource.entries()].map(([source, list]) => {
    const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const failures = sorted.filter((run) => run.status === 'failed').length;
    const lastSuccessAt = sorted.find((run) => run.status !== 'failed')?.created_at ?? null;
    const hoursSinceSuccess = lastSuccessAt ? (now - new Date(lastSuccessAt).getTime()) / 3_600_000 : Infinity;
    let state: SourceState = 'ok';
    if (sorted.slice(0, 2).every((run) => run.status === 'failed')) state = 'failing';
    else if (hoursSinceSuccess > STALE_AFTER_HOURS) state = 'stale';
    else if (sorted[0].status !== 'success' || failures / sorted.length > 0.3) state = 'unstable';
    return { source, state, runs: sorted.length, failures, lastRunAt: sorted[0].created_at, lastStatus: sorted[0].status, lastSuccessAt };
  }).sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.source.localeCompare(b.source));
}

/** The opportunity engine logs one entry per collector inside its latest run. */
export function latestEngineActors(runs: HealthRun[]): ActorHealth[] {
  const latest = runs.filter((run) => run.source === 'opportunity-engine').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const actors = latest?.detail?.actors;
  if (!Array.isArray(actors)) return [];
  return actors.flatMap((actor) => {
    const row = actor as { id?: unknown; status?: unknown; items?: unknown; errors?: unknown };
    return typeof row?.id === 'string' ? [{ id: row.id, status: String(row.status ?? ''), items: Number(row.items ?? 0), errors: Number(row.errors ?? 0) }] : [];
  });
}
