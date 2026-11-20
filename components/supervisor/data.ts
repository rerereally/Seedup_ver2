// Server callers pass the signed-in client. All database access stays in existing data-layer functions and RLS.
import type { SupabaseClient } from '@supabase/supabase-js';
import { draftReport, savedPrdCompetitorNotes, userIdeaDraft, userPrdById, userPrds, userPinnedDossierForSlug } from '@/lib/db/dossiers';
import { currentProjectGoal } from '@/lib/db/project-goals';
import { recentProjectVerifications } from '@/lib/db/verifications';
import { projectMemory } from '@/lib/db/project-memory';
import { resolveProjectKey, supervisorProject, userSupervisorProjects } from '@/lib/db/supervisor-projects';
import { cachedPrd } from '@/lib/db/server';
import { getOpportunities, getOpportunity } from '@/lib/opportunities/data';
import { readBuildProgress, readBuildProgressHistory, type BuildProgressHistory } from '@/lib/opportunities/build-progress';
import { readFeatureCommits, summarizeFeatureCommits } from '@/lib/opportunities/feature-commits';
import { activeGoalLine, contextText, pickNextTask, savedProject } from '@/lib/mcp/server';
import { hookBundle, hookSettings } from '@/lib/supervisor/hook-bundle';
import type { Evidence } from '@/lib/opportunities/types';
import { humanTasks } from '@/lib/supervisor/human-queue';
import { criteriaWithProgress, decodeProjectKey, driftForProject, featureSignals, latestActivity, mergeDrift } from './model';

export async function supervisorDetail(client: SupabaseClient, userId: string, rawKey: string) {
  const decoded = decodeProjectKey(rawKey);
  // resolveProjectKey only knows saved PRDs (the goal API relies on that); a draft key is resolved here for viewing.
  const draftId = decoded.match(/^prd:([0-9a-f-]{36})$/i)?.[1].toLowerCase();
  const key = await resolveProjectKey(client, userId, decoded)
    ?? (draftId && await userIdeaDraft(client, userId, draftId) ? `prd:${draftId}` as const : null);
  if (!key) return null;
  const personal = key.startsWith('prd:');
  const [project, dossier, opportunity] = await Promise.all([
    supervisorProject(client, userId, key),
    personal ? userPrdById(client, userId, key.slice(4)) : userPinnedDossierForSlug(client, userId, key),
    personal ? null : getOpportunity(key),
  ]);
  // A validate_idea draft has quotes but no PRD yet; the PRD list links it, so it opens with its quotes and report.
  const draft = personal && !dossier ? await userIdeaDraft(client, userId, key.slice(4)) : null;
  // A public opportunity existing does not make it this user's supervisor project.
  if (!project && !dossier && !draft) return null;
  const evidenceIds = dossier?.evidence_ids ?? opportunity?.evidence.slice(0, 12).map((row) => row.id) ?? [];
  const reportPromise = personal ? draftReport(client, userId, key.slice(4)).catch(() => null) : Promise.resolve(null);
  const personalSpec = async () => {
    if (!dossier) return null;
    const evidence = Array.isArray(dossier.evidence) ? dossier.evidence as Evidence[] : [];
    const competitorNotes = await savedPrdCompetitorNotes(client, userId, dossier, await reportPromise);
    return savedProject({ title: dossier.title, prdMarkdown: dossier.prd_markdown, evidence, competitorNotes }, key).result;
  };
  const [goal, memory, progress, commits, saved, verifications, history, report] = await Promise.all([
    currentProjectGoal(client, userId, key), projectMemory(client, userId, key),
    readBuildProgress(client, userId, key), readFeatureCommits(client, userId, key), personal ? personalSpec() : cachedPrd(evidenceIds),
    recentProjectVerifications(client, userId, key).catch(() => null),
    readBuildProgressHistory(client, userId, key).catch((): BuildProgressHistory => ({})),
    reportPromise,
  ]);
  const spec = saved?.spec ?? null;
  const lastActivityAt = latestActivity([
    dossier?.updated_at, goal?.lockedAt, ...Object.values(progress).map((row) => row.updatedAt),
    ...commits.map((row) => row.created_at), ...memory.decisions.map((row) => row.at),
    ...memory.handoffs.map((row) => row.at), ...memory.facts.map((row) => row.at),
    verifications?.[0]?.created_at,
  ]);
  const shownGoal = criteriaWithProgress(goal, progress);
  return {
    key, title: dossier?.title || draft?.title || opportunity?.name || key, goal: shownGoal, verifications, handoffs: memory.handoffs,
    criteriaMet: shownGoal?.criteria.filter((row) => row.status === 'met').length ?? 0,
    criteriaTotal: goal?.criteria.length ?? 0, lastActivityAt,
    features: featureSignals(spec, progress), specAvailable: Boolean(spec),
    // Only until a goal is locked: the dashboard drafts the goal from it (a PRD made over MCP has no other lock screen).
    lockSpec: goal ? null : spec,
    drift: mergeDrift(driftForProject(commits, spec, goal, progress), verifications), decisions: memory.decisions,
    // The rest of what MCP tools left behind, so the web shows it too: the PRD, its quotes, the repository and commits.
    prd: { markdown: dossier?.prd_markdown ?? null, quotes: dossierQuotes(dossier?.evidence ?? draft?.evidence), report },
    repo: project?.repo ?? null, track: project?.track ?? null, strict: project?.strict ?? false,
    commits: [...commits].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30).map((row) => ({ sha: row.sha, message: row.message, featureId: row.feature_id, files: row.files.length, at: row.created_at, dismissed: Boolean(row.dismissed_at) })),
    facts: memory.facts,
    // What get_next_task, explain_file and the PRD's flow views work from, for the work, file map and flow tabs.
    spec, progress, history,
    next: spec ? pickNextTask(spec, progress, goal) : null,
    // What the agent is handed, word for word: the MCP initialize line, the session-start hook file, the memory lines.
    context: {
      initialize: goal?.criteria.some((row) => row.status !== 'met') ? activeGoalLine(goal) : null,
      sessionStart: goal ? hookBundle(key, goal).find((file) => file.path === '.seedup/goal.md')?.content ?? null : null,
      memory: contextText(goal, { decisions: memory.decisions.slice(0, 3), handoffs: memory.handoffs.slice(0, 3), facts: memory.facts.slice(0, 3) }),
    },
    // What get_next_task puts before code (setup a person does) and what check_env compares the local names against.
    humanTasks: spec ? humanTasks(spec) : [],
    envNames: [...new Set([...(spec ? humanTasks(spec).flatMap((task) => task.envVars) : []),
      ...memory.facts.filter((fact) => fact.kind === 'env_name').map((fact) => fact.text)])],
    featureFiles: summarizeFeatureCommits(commits.filter((row) => !row.dismissed_at)),
    specQuotes: (saved?.input.evidence ?? []).map((row) => ({ quote: row.quote, url: row.url, platform: row.platform })),
    files: goal ? hookBundle(key, goal).map((file) => file.path === '.claude/settings.json'
      ? { ...file, content: `${JSON.stringify(hookSettings(), null, 2)}\n` } : file) : [],
  };
}

/** Quotes saved with a PRD (evidence_dossiers.evidence), kept only when they have text and a link. */
function dossierQuotes(evidence: unknown) {
  return (Array.isArray(evidence) ? evidence : []).flatMap((row: { quote?: unknown; url?: unknown; platform?: unknown }) =>
    typeof row?.quote === 'string' && typeof row.url === 'string' ? [{ quote: row.quote, url: row.url, platform: typeof row.platform === 'string' ? row.platform : '' }] : []).slice(0, 30);
}

/** Every saved PRD and idea draft, for the supervisor's PRD tab: MCP ones without a locked goal are not projects yet. */
export async function supervisorPrds(client: SupabaseClient, userId: string) {
  const rows = await userPrds(client, userId, 100);
  return rows.map((row) => ({ key: `prd:${row.id}`, title: row.title || row.id, hasPrd: Boolean(row.prd_markdown), quotes: row.evidence_ids.length, updatedAt: row.updated_at }));
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
    const shownGoal = criteriaWithProgress(goal, progress);
    return { key, title, goal: shownGoal, criteriaMet: shownGoal?.criteria.filter((row) => row.status === 'met').length ?? 0,
      criteriaTotal: shownGoal?.criteria.length ?? 0, lastActivityAt };
  }));
  return rows.sort((a, b) => (Date.parse(b.lastActivityAt ?? '') || 0) - (Date.parse(a.lastActivityAt ?? '') || 0));
}
