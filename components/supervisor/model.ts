import type { BuildProgress, FeatureStatus } from '@/lib/opportunities/build-progress';
import type { FeatureCommit } from '@/lib/opportunities/feature-commits';
import type { Spec } from '@/lib/opportunities/spec';
import { findDrift, type DriftCommit } from '@/lib/supervisor/drift';
import type { ProjectGoal, VerificationLevel } from '@/lib/supervisor/types';

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
    return { id, title, status: row?.status ?? 'todo', verification, note: row?.note ?? '' };
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
