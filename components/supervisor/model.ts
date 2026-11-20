import type { BuildProgress, FeatureStatus } from '@/lib/opportunities/build-progress';
import type { FeatureCommit } from '@/lib/opportunities/feature-commits';
import type { Spec } from '@/lib/opportunities/spec';
import { findDrift, type DriftCommit } from '@/lib/supervisor/drift';
import type { DriftFinding, ProjectGoal, VerificationLevel } from '@/lib/supervisor/types';

export type FeatureSignal = { id: string; title: string; status: FeatureStatus; verification: VerificationLevel; note: string };

export function decodeProjectKey(raw: string) {
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function featureSignals(spec: Spec | null, progress: BuildProgress): FeatureSignal[] {
  const titles = new Map(spec?.features.map((feature) => [feature.id, feature.title]) ?? []);
  for (const [id, row] of Object.entries(progress)) if (!titles.has(id)) titles.set(id, row.title);
  return [...titles].map(([id, title]) => {
    const row = progress[id];
    const level = row?.verificationLevel ?? (row as (typeof row & { verification?: string }) | undefined)?.verification;
    // Never infer verification from done or a free-text note. Only an explicit supervisor_verified column on a done feature turns green.
    const verification: VerificationLevel =
      row?.status === 'done' && level === 'supervisor_verified'
        ? 'supervisor_verified'
        : level === 'local_checked'
          ? 'local_checked'
          : 'self_reported';
    // The [supervisor_verified:<sha>] style tags are bookkeeping for the server, not text for people.
    // The per-criterion proof list stays in the record; the dashboard shows only how many checks passed.
    const note = (row?.note ?? '').replace(/\[(?:supervisor_verified|self_reported|local_checked)(?::[^\]\r\n]*)?\]/gi, '')
      .replace(/(checks \d+\/\d+) \([\s\S]*$/, '$1').trim();
    return { id, title, status: row?.status ?? 'todo', verification, note };
  });
}

/**
 * A success criterion follows the features linked to it: met once every linked feature is done with 🟢 supervisor
 * verification, partial once any linked feature is done, otherwise as locked. Stored values are never lowered.
 */
export function criteriaWithProgress(goal: ProjectGoal | null, progress: BuildProgress): ProjectGoal | null {
  if (!goal) return goal;
  return {
    ...goal,
    criteria: goal.criteria.map((criterion) => {
      const ids = criterion.featureIds ?? [];
      if (criterion.status === 'met' || !ids.length) return criterion;
      const done = ids.filter((id) => progress[id]?.status === 'done');
      const verified = done.filter((id) => progress[id]?.verificationLevel === 'supervisor_verified');
      const status = verified.length === ids.length ? 'met' : done.length ? 'partial' : criterion.status;
      return status === criterion.status ? criterion : { ...criterion, status };
    }),
  };
}

/**
 * Drift from recorded commits plus the scope warnings server verifications raised, one line per commit and kind
 * (verifications come newest first, so a commit re-verified several times keeps its latest wording).
 * null still means nothing has been recorded yet (no linked commits and no verification run).
 */
export function mergeDrift(commitDrift: DriftFinding[] | null, runs: Array<{ drift?: DriftFinding[] | null }> | null): DriftFinding[] | null {
  if (commitDrift === null && !runs?.length) return null;
  const seen = new Set<string>();
  return [...(commitDrift ?? []), ...(runs ?? []).flatMap((run) => run.drift ?? [])].filter((finding) => {
    const key = `${finding.sha}|${finding.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function latestActivity(values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

export function driftForProject(rows: FeatureCommit[], spec: Spec | null, goal: ProjectGoal | null, progress: BuildProgress) {
  if (!spec || !rows.length) return null;
  const grouped = new Map<string, DriftCommit & { at: string }>();
  for (const row of rows) {
    if (!row.feature_id && row.dismissed_at) continue;
    const commit = grouped.get(row.sha) ?? { sha: row.sha, message: row.message, files: [], featureIds: [], fileStatuses: {}, addedFiles: [], at: row.created_at };
    commit.files = [...new Set([...commit.files, ...row.files])];
    if (row.file_statuses) {
      commit.fileStatuses = { ...commit.fileStatuses, ...row.file_statuses };
      commit.addedFiles = [...new Set([
        ...(commit.addedFiles ?? []),
        ...Object.entries(row.file_statuses).filter(([, status]) => status === 'added').map(([path]) => path),
      ])];
    }
    if (row.feature_id) commit.featureIds = [...new Set([...commit.featureIds, row.feature_id])];
    grouped.set(row.sha, commit);
  }
  if (!grouped.size) return null;
  return [...grouped.values()].flatMap((commit) => {
    const doneFiles: Record<string, string[]> = {};
    for (const row of rows) {
      const feature = progress[row.feature_id];
      // Only files linked before this commit, to a feature already done then, are evidence of touched_done.
      if (feature?.status !== 'done' || !feature.doneAt || Date.parse(feature.doneAt) > Date.parse(commit.at)
        || Date.parse(row.created_at) >= Date.parse(commit.at)) continue;
      doneFiles[row.feature_id] = [...new Set([...(doneFiles[row.feature_id] ?? []), ...row.files])];
    }
    return findDrift([commit], spec, goal, doneFiles);
  });
}
