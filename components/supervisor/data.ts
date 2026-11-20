// Server callers pass the signed-in client. All database access stays in existing data-layer functions and RLS.
import type { SupabaseClient } from '@supabase/supabase-js';
import { userPrdById, userPrds, userPinnedDossierForSlug } from '@/lib/db/dossiers';
import { currentProjectGoal } from '@/lib/db/project-goals';
import { recentProjectVerifications } from '@/lib/db/verifications';
import { projectMemory } from '@/lib/db/project-memory';
import { resolveProjectKey, supervisorProject, userSupervisorProjects } from '@/lib/db/supervisor-projects';
import { cachedPrd } from '@/lib/db/server';
import { getOpportunities, getOpportunity } from '@/lib/opportunities/data';
import { readBuildProgress } from '@/lib/opportunities/build-progress';
import { readFeatureCommits } from '@/lib/opportunities/feature-commits';
import { hookBundle, hookSettings } from '@/lib/supervisor/hook-bundle';
import { decodeProjectKey, driftForProject, featureSignals, latestActivity } from './model';

export async function supervisorDetail(client: SupabaseClient, userId: string, rawKey: string) {
  const key = await resolveProjectKey(client, userId, decodeProjectKey(rawKey));
  if (!key) return null;
  const [project, dossier, opportunity] = await Promise.all([
    supervisorProject(client, userId, key),
    key.startsWith('prd:') ? userPrdById(client, userId, key.slice(4)) : userPinnedDossierForSlug(client, userId, key),
    key.startsWith('prd:') ? null : getOpportunity(key),
  ]);
  // A public opportunity existing does not make it this user's supervisor project.
  if (!project && !dossier) return null;
  const evidenceIds = dossier?.evidence_ids ?? opportunity?.evidence.slice(0, 12).map((row) => row.id) ?? [];
  const [goal, memory, progress, commits, cached, verifications] = await Promise.all([
    currentProjectGoal(client, userId, key), projectMemory(client, userId, key),
    readBuildProgress(client, userId, key), readFeatureCommits(client, userId, key), cachedPrd(evidenceIds),
    recentProjectVerifications(client, userId, key).catch(() => null),
  ]);
  const spec = cached?.spec ?? null;
  const lastActivityAt = latestActivity([
    dossier?.updated_at, goal?.lockedAt, ...Object.values(progress).map((row) => row.updatedAt),
    ...commits.map((row) => row.created_at), ...memory.decisions.map((row) => row.at),
    ...memory.handoffs.map((row) => row.at), ...memory.facts.map((row) => row.at),
    verifications?.[0]?.created_at,
  ]);
  return {
    key, title: dossier?.title || opportunity?.name || key, goal, verifications, handoffs: memory.handoffs,
    criteriaMet: goal?.criteria.filter((row) => row.status === 'met').length ?? 0,
    criteriaTotal: goal?.criteria.length ?? 0, lastActivityAt,
    features: featureSignals(spec, progress), specAvailable: Boolean(spec),
    drift: driftForProject(commits, spec, goal, progress), decisions: memory.decisions,
    files: goal ? hookBundle(key, goal).map((file) => file.path === '.claude/settings.json'
      ? { ...file, content: `${JSON.stringify(hookSettings(), null, 2)}\n` } : file) : [],
  };
}

export type SupervisorDetail = NonNullable<Awaited<ReturnType<typeof supervisorDetail>>>;
export type ProjectSummary = Pick<SupervisorDetail, 'key' | 'title' | 'goal' | 'criteriaMet' | 'criteriaTotal' | 'lastActivityAt'>;

export async function supervisorList(client: SupabaseClient, userId: string): Promise<ProjectSummary[]> {
  // Only real supervisor projects (a locked goal, memory or a connected repo), not every saved PRD or public opportunity.
  const projects = await userSupervisorProjects(client, userId);
  if (!projects.length) return [];
  const needsPrd = projects.some((row) => row.projectKey.startsWith('prd:'));
  const needsSource = projects.some((row) => !row.projectKey.startsWith('prd:'));
  const [dossiers, source] = await Promise.all([needsPrd ? userPrds(client, userId, 1000) : [], needsSource ? getOpportunities() : null]);
  // Same rule as the detail page: a deleted PRD or an unpublished opportunity would open a 404, so it is not listed.
  const candidates = projects.flatMap((row) => {
    const key = row.projectKey;
    if (key.startsWith('prd:')) {
      // A validate_idea draft has no PRD yet, so it has nothing to supervise until generate_verified_prd makes one.
      const dossier = dossiers.find((item) => `prd:${item.id}` === key && item.prd_markdown);
      return dossier ? [{ key, title: dossier.title || key, updatedAt: row.updatedAt }] : [];
    }
    const published = source?.opportunities.find((item) => item.slug === key);
    if (!published) return [];
    return [{ key, title: dossiers.find((item) => item.opportunity_slug === key)?.title || published.name || key, updatedAt: row.updatedAt }];
  });
  const rows = await Promise.all(candidates.map(async ({ key, title, updatedAt }) => {
    const [goal, memory, progress, commits] = await Promise.all([
      currentProjectGoal(client, userId, key), projectMemory(client, userId, key),
      readBuildProgress(client, userId, key), readFeatureCommits(client, userId, key),
    ]);
    const lastActivityAt = latestActivity([updatedAt, goal?.lockedAt, ...Object.values(progress).map((row) => row.updatedAt),
      ...commits.map((row) => row.created_at), ...memory.decisions.map((row) => row.at),
      ...memory.handoffs.map((row) => row.at), ...memory.facts.map((row) => row.at)]);
    return { key, title, goal, criteriaMet: goal?.criteria.filter((row) => row.status === 'met').length ?? 0,
      criteriaTotal: goal?.criteria.length ?? 0, lastActivityAt };
  }));
  return rows.sort((a, b) => (Date.parse(b.lastActivityAt ?? '') || 0) - (Date.parse(a.lastActivityAt ?? '') || 0));
}
