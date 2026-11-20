import { consumeUsageFor, releaseUsageFor, userForToken } from '@/lib/mcp/auth';
import { projectPage } from '@/lib/mcp/apps';
import { handleRpc } from '@/lib/mcp/server';
import type { McpDeps, SavedPrdDetail, SavedPrdSummary } from '@/lib/mcp/server';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { specInputFor } from '@/lib/opportunities/context';
import { flagBuildProgressForCommit, readBuildProgress, writeBuildProgress } from '@/lib/opportunities/build-progress';
import { countUnlinkedCommits, featureFiles, writeFeatureCommit } from '@/lib/opportunities/feature-commits';
import { generatePrd, generateSlots } from '@/lib/opportunities/prd';
import { readLatestPrdCacheForTitle, readPrdCache, writePrdCache } from '@/lib/opportunities/prd-cache';
import { parsePrdMarkdown } from '@/lib/opportunities/prd-markdown';
import { normalizeSpec, renderSpecMarkdown } from '@/lib/opportunities/spec';
import type { Evidence } from '@/lib/opportunities/types';
import { retrieveIdeaContext } from '@/lib/ingest/rag';
import { createAdminClient } from '@/lib/supabase/admin';
import { readKept } from '@/lib/mcp/kept';
import { buildValidationReport, renderReport } from '@/lib/opportunities/report';
import { saveDossier, userPinnedDossierForSlug, userPrdById, userPrds } from '@/lib/db/dossiers';
import { currentProjectGoal } from '@/lib/db/project-goals';
import { addProjectMemory, projectMemory } from '@/lib/db/project-memory';
import { supervisorProject, updateSupervisorProject } from '@/lib/db/supervisor-projects';
import { readVerificationToken } from '@/lib/supervisor/verify-token';
import { getVerification, startVerification } from '@/lib/verifier/run';
import { createHash } from 'node:crypto';
import { addWatch } from '@/lib/db/watches';
import { onboardingAnswers, onboardingRow } from '@/lib/db/onboarding';
import { preferredStack } from '@/lib/onboarding';
import { sendWebhook } from '@/lib/newsletter/webhooks';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

// How long get_next_task waits for a feature's readiness slots before answering with open questions.
const SLOT_FILL_MS = 45_000;
const NO_STORE = { 'Cache-Control': 'no-store' };
const IP_REQUESTS_PER_MINUTE = 60;
const USER_REQUESTS_PER_MINUTE = 30;

const unauthorized = () => NextResponse.json(
  { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid token. Create one at /agents (MCP 연동).' } },
  { status: 401, headers: { 'WWW-Authenticate': 'Bearer', ...NO_STORE } },
);

const throttled = () => NextResponse.json(
  { jsonrpc: '2.0', id: null, error: { code: -32029, message: 'Too many requests. Try again in a minute.' } },
  { status: 429, headers: { 'Retry-After': '60', ...NO_STORE } },
);

/**
 * The MCP endpoint: a personal token, not a Supabase session, says who is calling, so it runs with the service key and
 * every data call below names that user. Streamable HTTP, JSON responses only (no server-sent events).
 * `pathKey` is the token taken from /api/mcp/<token>, for apps whose connector form has no header field.
 */
export async function handleMcpRequest(request: Request, pathKey?: string) {
  if (await rateLimited(`mcp:ip:${clientOf(request)}`, IP_REQUESTS_PER_MINUTE)) return throttled();
  const service = createAdminClient();
  if (!service) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Server is not configured' } }, { status: 503, headers: NO_STORE });
  const userId = await userForToken(service, pathKey ? `Bearer ${pathKey}` : request.headers.get('authorization'));
  if (!userId) return unauthorized();
  if (await rateLimited(`mcp:user:${userId}`, USER_REQUESTS_PER_MINUTE)) return throttled();

  const body = await request.json().catch(() => undefined);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  const deps: McpDeps = {
    opportunities: async () => (await getOpportunities()).opportunities,
    cachedSpec: (ids) => readPrdCache(service, ids),
    pinnedSpec: async (slug, opportunity) => {
      const pinned = await userPinnedDossierForSlug(service, userId, slug);
      if (pinned) {
        if (pinned.evidence_ids.length) {
          const cached = await readPrdCache(service, pinned.evidence_ids);
          if (cached) return cached;
        }
        const parsed = parsePrdMarkdown(pinned.prd_markdown);
        if (parsed) {
          const evidence = Array.isArray(pinned.evidence) ? (pinned.evidence as Evidence[]) : opportunity.evidence;
          const direct = opportunity.supply.filter((row) => row.relation === 'direct');
          const competitorNotes = direct.map((row) => row.description ? `${row.name}: ${row.description}` : row.name);
          const spec = normalizeSpec(parsed, evidence, !opportunity.qualified, { competitorNotes });
          return {
            input: {
              title: pinned.title || opportunity.name,
              problem: opportunity.problem,
              gap: opportunity.gap,
              evidence,
              competitors: direct.map((row) => row.name),
              competitorNotes,
            },
            spec,
          };
        }
      }
      return readLatestPrdCacheForTitle(service, opportunity.name);
    },
    pin: async (slug, result, replace) => {
      if (!replace && await userPinnedDossierForSlug(service, userId, slug)) return;
      const ids = result.input.evidence.map((item) => item.id);
      await saveDossier(service, {
        user_id: userId,
        dossier_key: createHash('sha256').update([...ids].sort().join(',')).digest('hex').slice(0, 32),
        title: result.input.title,
        opportunity_slug: slug,
        evidence_ids: ids,
        evidence: result.input.evidence,
        prd_markdown: renderSpecMarkdown(result.input, result.spec),
      });
    },
    fillSlots: async (cached, featureId) => {
      const feature = cached.spec.features.find((row) => row.id === featureId);
      if (!feature) return null;
      const rows = [...cached.spec.requirements, ...cached.spec.hypotheses].filter((row) => feature.requirementIds.includes(row.id));
      // A free model can take a minute; the agent gets the task with open questions rather than waiting longer.
      const slots = await Promise.race([
        generateSlots(cached.input, feature, rows, cached.spec.lang ?? 'ko').catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SLOT_FILL_MS)),
      ]);
      if (!slots) return null;
      const spec = { ...cached.spec, features: cached.spec.features.map((row) => (row.id === featureId ? { ...row, slots } : row)) };
      await writePrdCache(service, cached.input.evidence.map((item) => item.id), cached.input, spec);
      return { input: cached.input, spec };
    },
    myPrds: async (limit): Promise<SavedPrdSummary[]> => {
      const rows = await userPrds(service, userId, limit);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        opportunitySlug: row.opportunity_slug,
        evidenceCount: Array.isArray(row.evidence_ids) ? row.evidence_ids.length : 0,
        updatedAt: row.updated_at,
      }));
    },
    myPrd: async (id): Promise<SavedPrdDetail | null> => {
      const row = await userPrdById(service, userId, id);
      if (!row) return null;
      const needsListings = /^- (?:경쟁 도구 설명|Competitor listing):/m.test(row.prd_markdown);
      const catalog = needsListings ? (await getOpportunities()).opportunities : [];
      const picked = findEvidence(catalog, Array.isArray(row.evidence_ids) ? row.evidence_ids : []);
      return {
        id: row.id,
        title: row.title,
        opportunitySlug: row.opportunity_slug,
        evidenceCount: Array.isArray(row.evidence_ids) ? row.evidence_ids.length : 0,
        updatedAt: row.updated_at,
        prdMarkdown: row.prd_markdown,
        evidence: Array.isArray(row.evidence) ? (row.evidence as Evidence[]) : [],
        competitorNotes: specInputFor(catalog, picked)?.competitorNotes,
      };
    },
    projectGoal: (key) => currentProjectGoal(service, userId, key),
    projectMemory: (key, limit) => projectMemory(service, userId, key, limit),
    addProjectMemory: (key, entry) => addProjectMemory(service, userId, key, entry).catch(() => {
      throw new Error('Could not write project memory');
    }),
    supervisorProject: (key) => supervisorProject(service, userId, key),
    connectRepo: async (key, repo) => {
      const token = process.env.GITHUB_TOKEN?.trim();
      if (!token) return null;
      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': 'seedup' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null);
      if (!response?.ok) return null;
      const found = await response.json().catch(() => null) as { private?: boolean; visibility?: string; full_name?: string } | null;
      if (found?.private !== false || found.visibility !== 'public' || typeof found.full_name !== 'string') return null;
      return (await updateSupervisorProject(service, userId, key, { repo: found.full_name })).repo;
    },
    generate: async (input, draft) => {
      const result = await generatePrd(input, { draft }).catch(() => null);
      if (result) await writePrdCache(service, input.evidence.map((item) => item.id), input, result.spec);
      return result?.spec ?? null;
    },
    consume: (feature, limit) => consumeUsageFor(service, userId, feature, limit),
    release: (feature) => releaseUsageFor(service, userId, feature),
    related: async (idea) => (await retrieveIdeaContext(idea, { maxReferences: 6, syncMissing: false, throwOnError: true })).map((row) => ({
      title: String(row.metadata.title ?? row.source_table),
      url: row.metadata.url ?? null,
      source: String(row.metadata.source ?? row.source_table),
      similarity: row.similarity,
    })),
    progress: (slug) => readBuildProgress(service, userId, slug),
    linkCommit: (slug, link) => writeFeatureCommit(service, userId, slug, link),
    featureFiles: (slug, beforeSha) => featureFiles(service, userId, slug, beforeSha),
    flagRecheck: (slug, id, sha, note) => flagBuildProgressForCommit(service, userId, slug, id, sha, note),
    unlinkedCommitCount: (slug) => countUnlinkedCommits(service, userId, slug),
    startVerification: (input) => startVerification({ ...input, userId }),
    getVerification: (id) => getVerification(userId, id),
    matchesVerificationToken: (token, projectKey, featureId, sha) =>
      Boolean(readVerificationToken(token, { userId, projectKey, featureId, sha })),
    setProgress: (slug, feature, status, note) => writeBuildProgress(service, userId, slug, feature, status, note),
    notifyBlocked: async (opportunity, feature) => {
      const settings = await onboardingRow<{ notify_webhook: string | null }>(service, userId, 'notify_webhook');
      if (settings?.notify_webhook) {
        await sendWebhook(settings.notify_webhook, `${opportunity.name} · 기능 막힘`, `${feature.id} ${feature.title}\n${projectPage(siteUrl, opportunity.slug)}`);
      }
    },
    kept: (type, limit) => readKept(service, userId, type, limit, siteUrl),
    validate: async (idea) => {
      const [{ opportunities }, answers] = await Promise.all([getOpportunities(), onboardingAnswers(service, userId)]);
      const report = await buildValidationReport(idea, opportunities, { stack: preferredStack(answers), searchCounterEvidence: true }).catch(() => null);
      return report ? renderReport(report, siteUrl) : null;
    },
    watch: async (idea) => typeof (await addWatch(service, userId, idea)) === 'object',
  };
  const answer = await handleRpc(body, deps, siteUrl);
  return answer === null ? new Response(null, { status: 202, headers: NO_STORE }) : NextResponse.json(answer, { headers: NO_STORE });
}
