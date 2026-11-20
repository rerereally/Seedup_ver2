// Server callers pass the signed-in client. All database access stays in existing data-layer functions and RLS.
import type { SupabaseClient } from '@supabase/supabase-js';
import { userPrdById, userPrds, userPinnedDossierForSlug } from '@/lib/db/dossiers';
import { currentProjectGoal } from '@/lib/db/project-goals';
import { projectMemory } from '@/lib/db/project-memory';
import { resolveProjectKey, supervisorProject } from '@/lib/db/supervisor-projects';
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
  const [goal, memory, progress, commits, cached] = await Promise.all([
    currentProjectGoal(client, userId, key), projectMemory(client, userId, key),
    readBuildProgress(client, userId, key), readFeatureCommits(client, userId, key), cachedPrd(evidenceIds),
  ]);
  const spec = cached?.spec ?? null;
  const lastActivityAt = latestActivity([
    dossier?.updated_at, goal?.lockedAt, ...Object.values(progress).map((row) => row.updatedAt),
    ...commits.map((row) => row.created_at), ...memory.decisions.map((row) => row.at),
    ...memory.handoffs.map((row) => row.at), ...memory.facts.map((row) => row.at),
  ]);
  return {
    key, title: dossier?.title || opportunity?.name || key, goal,
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
  // No project-list data-layer function exists yet. Discover keys through published opportunities and owned PRDs.
  const [source, dossiers] = await Promise.all([getOpportunities(), userPrds(client, userId, 1000)]);
  const slugs = new Set([...source.opportunities.map((row) => row.slug), ...dossiers.flatMap((row) => row.opportunity_slug ? [row.opportunity_slug] : [])]);
  const publicProjects = await Promise.all([...slugs].map(async (key) => {
    const dossier = dossiers.find((row) => row.opportunity_slug === key);
    if (!await supervisorProject(client, userId, key) && !dossier) return [];
    // resolveProjectKey checks that even a saved slug is still a published opportunity.
    if (!await resolveProjectKey(client, userId, key)) return [];
    return [{ key, title: dossier?.title || source.opportunities.find((row) => row.slug === key)?.name || key, updatedAt: dossier?.updated_at }];
  }));
  const candidates = [...publicProjects.flat(), ...dossiers.map((row) => ({ key: `prd:${row.id}`, title: row.title, updatedAt: row.updated_at }))];
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
