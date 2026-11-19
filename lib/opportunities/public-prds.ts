import type { ListedPrd } from '@/lib/db/dossiers';

export type ProblemGroup = { slug: string; name: string; prds: number; built: number };

/** How many listed PRDs, and how many of them were built, each problem has. Most PRDs first; unknown problems skipped. */
export function problemGroups(rows: ListedPrd[], names: Map<string, string>): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>();
  for (const row of rows) {
    const name = row.opportunity_slug ? names.get(row.opportunity_slug) : undefined;
    if (!row.opportunity_slug || !name) continue;
    const group = groups.get(row.opportunity_slug) ?? { slug: row.opportunity_slug, name, prds: 0, built: 0 };
    group.prds++;
    if (row.built_url) group.built++;
    groups.set(row.opportunity_slug, group);
  }
  return [...groups.values()].sort((a, b) => b.prds - a.prds || b.built - a.built);
}

/**
 * Where "start my own from this" goes: the PRD workspace with the same public quotes, or the idea workspace with the
 * title when the PRD stood only on quotes found for its owner (lv_), which are signed for that owner and not reused.
 */
export function forkHref(row: Pick<ListedPrd, 'title' | 'evidence_ids'>) {
  const ids = (row.evidence_ids ?? []).filter((id) => id.startsWith('ev_')).slice(0, 24);
  return ids.length ? `/prd?evidence=${ids.map(encodeURIComponent).join(',')}` : `/prd/new?idea=${encodeURIComponent(row.title.slice(0, 300))}`;
}
