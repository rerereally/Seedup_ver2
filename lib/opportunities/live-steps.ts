// The steps of one PRD generation as the reader sees them (components/opportunity-stage/PrdParts.tsx).
export type LivePhase = 'waiting' | 'thinking' | 'writing' | 'structuring' | 'checking' | 'auditing' | 'completing';

/** One thing the server did while making the PRD, with the second it started. */
export type LiveStep = { kind: 'phase'; phase: LivePhase; at: number } | { kind: 'section'; title: string; at: number } | { kind: 'restart'; at: number };

/**
 * The step list after one more event: a new phase, a model restart, or (while writing) each new section heading.
 * Sections count from the last restart, since a restart begins the document again.
 */
export function liveStepsAfter(steps: LiveStep[], event: { phase: LivePhase; text: string; restarted: boolean; at: number }): LiveStep[] {
  const next = [...steps];
  if (event.restarted) next.push({ kind: 'restart', at: event.at });
  const lastPhase = [...next].reverse().find((step) => step.kind === 'phase');
  if (!lastPhase || lastPhase.kind !== 'phase' || lastPhase.phase !== event.phase || event.restarted) next.push({ kind: 'phase', phase: event.phase, at: event.at });
  if (event.phase === 'writing') {
    const since = next.map((step) => step.kind).lastIndexOf('restart');
    const known = next.slice(since + 1).filter((step) => step.kind === 'section').length;
    // Only finished heading lines: a heading still being streamed would be recorded cut short.
    const titles = [...event.text.matchAll(/^#{1,3}[ \t]+(.+?)[ \t]*\n/gm)].map((match) => match[1].slice(0, 60));
    for (const title of titles.slice(known)) next.push({ kind: 'section', title, at: event.at });
  }
  return next.length === steps.length ? steps : next;
}
