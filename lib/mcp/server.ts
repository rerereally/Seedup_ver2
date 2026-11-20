// Seedup as an MCP server (Streamable HTTP, JSON responses only). The transport is plain JSON-RPC 2.0, so this file
// has no dependency: the route hands it the parsed body and a context with the data sources it may use.
import { appResource, checklistCard, nextTaskCard, opportunitiesCard, prdCard, projectPage, readAppResource, withAppMeta } from '@/lib/mcp/apps';
import type { MemoryEntry, ProjectMemory } from '@/lib/db/project-memory';
import { AGENT_FEATURE_STATUSES, normalizeFeatureId } from '@/lib/opportunities/build-progress';
import type { AgentFeatureStatus, BuildProgress } from '@/lib/opportunities/build-progress';
import { touchedDoneFeatures } from '@/lib/opportunities/feature-commits';
import { specInputFor } from '@/lib/opportunities/context';
import { PRD_MAX_EVIDENCE } from '@/lib/opportunities/prd-cache';
import { parsePrdMarkdown } from '@/lib/opportunities/prd-markdown';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { EXPORT_FILES, normalizeSpec, OPEN_SLOT_MARKER, renderAgentBrief, renderSpecMarkdown, SLOT_KEYS, SLOT_LABELS_EN, withPrdReadiness } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecInput, SpecRival } from '@/lib/opportunities/spec';
import { publicEvidence } from '@/lib/opportunities/types';
import type { Evidence, Opportunity } from '@/lib/opportunities/types';
import { isGitHubLogin } from '@/lib/seeds/github';
import { featureContribution, goalSummary } from '@/lib/supervisor/goal';
import { humanTasks } from '@/lib/supervisor/human-queue';
import type { Decision, ProjectGoal, ProjectKey, SupervisorProject } from '@/lib/supervisor/types';

export const MCP_DAILY_PRD_LIMIT = 10;
export const MCP_DAILY_REPORT_LIMIT = 3;
export const MCP_MAX_BATCH_SIZE = 10;
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export type SavedPrdSummary = {
  id: string;
  title: string;
  opportunitySlug: string | null;
  evidenceCount: number;
  updatedAt: string;
};

export type SavedPrdDetail = SavedPrdSummary & {
  prdMarkdown: string;
  evidence: Evidence[];
  competitorNotes?: string[];
};

export type McpDeps = {
  opportunities: () => Promise<Opportunity[]>;
  /** The last good PRD for this exact evidence set, if one was generated before. */
  cachedSpec: (evidenceIds: string[]) => Promise<{ input: SpecInput; spec: Spec } | null>;
  /** Fallback pinned PRD for an opportunity slug (user dossier or latest cached PRD) when daily evidence shifts. */
  pinnedSpec?: (slug: string, opportunity: Opportunity) => Promise<{ input: SpecInput; spec: Spec } | null>;
  /**
   * Fills the six readiness slots of one feature that has none and returns the updated PRD, or null when it could
   * not in time. The result is cached for later calls.
   */
  fillSlots?: (cached: { input: SpecInput; spec: Spec }, featureId: string) => Promise<{ input: SpecInput; spec: Spec } | null>;
  /** Saves this PRD as the user's pinned one for the slug; keeps an existing pin unless `replace`. */
  pin?: (slug: string, result: { input: SpecInput; spec: Spec }, replace: boolean) => Promise<void>;
  /** Saved personal and problem PRDs owned by this user. */
  myPrds?: (limit: number) => Promise<SavedPrdSummary[]>;
  /** One saved PRD owned by this user, with its markdown and evidence. */
  myPrd?: (id: string) => Promise<SavedPrdDetail | null>;
  projectGoal?: (key: ProjectKey) => Promise<ProjectGoal | null>;
  projectMemory?: (key: ProjectKey, limit: number) => Promise<ProjectMemory>;
  addProjectMemory?: (key: ProjectKey, entry: MemoryEntry) => Promise<{ id: string }>;
  supervisorProject?: (key: ProjectKey) => Promise<SupervisorProject | null>;
  connectRepo?: (key: ProjectKey, repo: string) => Promise<string | null>;
  generate: (input: SpecInput, draft: boolean) => Promise<Spec | null>;
  consume: (feature: string, dailyLimit: number) => Promise<boolean>;
  /** Refunds one metered use when the downstream model call fails or returns nothing usable. */
  release?: (feature: string) => Promise<void>;
  related: (idea: string) => Promise<Array<{ title: string; url: string | null; source: string; similarity: number }>>;
  progress: (slug: string) => Promise<BuildProgress>;
  linkCommit(slug: string, link: { sha: string; message: string; files: string[]; featureIds: string[] }): Promise<void>;
  featureFiles(slug: string, beforeSha?: string): Promise<Record<string, string[]>>;
  flagRecheck(slug: string, featureId: string, sha: string, note: string): Promise<boolean>;
  unlinkedCommitCount(slug: string): Promise<number>;
  verifyFeature: (prompt: string) => Promise<unknown>;
  /** Returns true when the feature enters blocked, so retries of the same status do not notify again. */
  setProgress: (slug: string, feature: { id: string; title: string }, status: AgentFeatureStatus, note: string) => Promise<boolean>;
  notifyBlocked: (opportunity: Opportunity, feature: { id: string; title: string }) => Promise<void>;
  /** What this user kept on the site (repos, articles, papers, products), newest first. */
  kept: (type: KeptType | null, limit: number) => Promise<KeptItem[]>;
  /** A validation report for one idea, as Markdown; null when it could not be made. */
  validate: (idea: string) => Promise<string | null>;
  /** Starts a weekly watch on one idea; false when the person already watches the most allowed. */
  watch: (idea: string) => Promise<boolean>;
};

export const KEPT_TYPES = ['github', 'news', 'paper', 'ai_product', 'project'] as const;
export type KeptType = (typeof KEPT_TYPES)[number];
export type KeptItem = { type: string; title: string; note: string | null; url: string; page: string; savedAt: string; extra?: string };

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean; structuredContent?: Record<string, unknown> };

const text = (value: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: value }], ...(isError ? { isError } : {}) });

const keyDescription = 'Public opportunity slug or prd:<id> from list_my_prds';
const projectProperties = {
  project: { type: 'string', description: keyDescription },
  slug: { type: 'string', description: 'Alias for project' },
};

function projectSchema(properties = {}, required: string[] = []) {
  return {
    type: 'object',
    properties: { ...projectProperties, ...properties },
    anyOf: [{ required: ['project'] }, { required: ['slug'] }],
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

const progressProperties = {
  note: { type: 'string', description: 'One line on what changed or what is blocking work' },
  checks: {
    type: 'array',
    description: 'Required for done. One passing check with evidence per numbered criterion from get_next_task or get_build_checklist.',
    items: {
      type: 'object',
      properties: {
        criterion: { type: 'number', description: 'The criterion number from get_next_task or get_build_checklist' },
        passed: { type: 'boolean' },
        evidence: { type: 'string', description: 'How it was checked: the test name and its result, or the command and its output, in one line' },
      },
      required: ['criterion', 'passed', 'evidence'],
    },
  },
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const STATE_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const MEMORY_WRITE = { ...STATE_WRITE, idempotentHint: false } as const;
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,99}$/;
const memoryLine = { type: 'string', maxLength: 500 };
const memoryLines = { type: 'array', maxItems: 10, items: memoryLine };
const APPROVED = '대화에서 승인';
const REJECTED = '대화에서 거절';
const ASK_USER = `사용자에게 터미널에서 물어라. Ask the user before changing the goal or scope. Call record_decision again with approval "${APPROVED}" or "${REJECTED}" after the user answers.`;

export const TOOLS = [
  {
    name: 'search_opportunities',
    description: 'Search Seedup build opportunities: developer pains with verified quotes from GitHub, Hacker News and Stack Overflow, and how crowded the market is.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords, e.g. "agent memory" or "schema"' }, limit: { type: 'number', minimum: 1, maximum: 10 } }, required: ['query'] },
    annotations: READ_ONLY,
  },
  {
    name: 'get_opportunity',
    description: 'Full detail of one opportunity: the problem, the gap, every verified quote with its source link, and direct competitors.',
    inputSchema: projectSchema(),
    annotations: READ_ONLY,
  },
  {
    name: 'generate_verified_prd',
    description: 'An evidence-traced PRD for one opportunity (evidence → requirements → features → screens) as AGENTS.md, CLAUDE.md, a Cursor rule (.cursor/rules/seedup.mdc), a paste-in prompt for app builders (Lovable, Bolt, v0) or PRD markdown. Every requirement cites a verified quote; below the evidence bar it is labeled a hypothesis draft.',
    inputSchema: projectSchema({
      format: { type: 'string', enum: ['agents', 'claude', 'cursor', 'prompt', 'prd'], description: 'Default agents (AGENTS.md)' },
      fresh: { type: 'boolean', description: 'Generate again for a public opportunity' },
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'get_build_checklist',
    description: 'The build checklist of the PRD made by generate_verified_prd: every feature (F-01, F-02, ...) with its current status and done criteria.',
    inputSchema: projectSchema(),
    annotations: READ_ONLY,
  },
  {
    name: 'get_next_task',
    description: 'Call at the start of a session. Returns the locked goal, recent memory, and one ready feature ranked by contribution to the goal, with done criteria and evidence.',
    inputSchema: projectSchema(),
    annotations: READ_ONLY,
  },
  {
    name: 'update_feature_status',
    description: 'Report the current status of a PRD feature. Use in_progress when starting, and done with checks or blocked when ending.',
    inputSchema: projectSchema({
      ...progressProperties,
      feature_id: { type: 'string', description: 'Feature id, e.g. F-01' },
      status: { type: 'string', enum: AGENT_FEATURE_STATUSES },
    }, ['feature_id', 'status']),
    annotations: STATE_WRITE,
  },
  {
    name: 'mark_feature_done',
    description: 'Compatibility alias for reporting done with checks or returning a feature to todo.',
    inputSchema: projectSchema({
      ...progressProperties,
      feature: { type: 'string', description: 'Feature id, e.g. F-01' },
      done: { type: 'boolean', description: 'Default true; false sets todo' },
    }, ['feature']),
    annotations: STATE_WRITE,
  },
  {
    name: 'link_commit',
    description: 'Record a commit and its changed file paths for a PRD. Use only when the user has enabled commit uploads for this project. Features default to the F-n ids in the commit message.',
    inputSchema: projectSchema({
      sha: { type: 'string', pattern: '^[a-fA-F0-9]{7,40}$' },
      message: { type: 'string', maxLength: 500 },
      files: { type: 'array', maxItems: 200, items: { type: 'string', maxLength: 300, description: 'Repository-relative path' } },
      features: { type: 'array', items: { type: 'string' }, description: 'Override feature ids from the commit message' },
    }, ['sha', 'message', 'files']),
    annotations: STATE_WRITE,
  },
  {
    name: 'verify_feature',
    description: 'Get a model opinion on whether a diff meets each PRD done criterion. Uses the first 20,000 characters of the diff. Feature status stays unchanged. Up to 10 calls a day.',
    inputSchema: projectSchema({ feature: { type: 'string' }, diff: { type: 'string' } }, ['feature', 'diff']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'get_kept_items',
    description: 'What the user kept on Seedup to use later: GitHub repositories, articles, papers and products, with their links, newest first. Read them as references before planning or building, e.g. a repo to reuse or an article the user wants applied.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['all', ...KEPT_TYPES], description: 'Default all; github returns only kept repositories' },
        limit: { type: 'number', minimum: 1, maximum: 50, description: 'Default 20' },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: 'find_related_content',
    description: 'News, papers, repos and products Seedup collected that are semantically close to an idea, for grounding an evaluation.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
    annotations: READ_ONLY,
  },
  {
    name: 'validate_idea',
    description: 'Should I build this? A report for one idea: real quotes from GitHub issues, Hacker News and Stack Overflow (kept only when they match the source word for word), the tools that already solve it, how big a first version is for one person, where the first users are, and a verdict on the 3-quotes-from-2-sites bar. Takes about a minute; 3 a day.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string', description: 'The idea in one sentence, any language' } }, required: ['idea'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'watch_idea',
    description: 'Watch one idea: once a week Seedup searches again and mails the user any new quotes or new rival tools for it. Up to 10 ideas.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
    annotations: STATE_WRITE,
  },
  {
    name: 'list_my_prds',
    description: 'List PRDs the user saved on Seedup (including personal idea PRDs and saved opportunity PRDs), newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, description: 'Default 20' },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_my_prd',
    description: 'Read one saved PRD owned by this user (by id from list_my_prds) as PRD markdown or an agent brief (AGENTS.md, CLAUDE.md, Cursor rule, or app-builder prompt).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Saved PRD id (UUID from list_my_prds)' },
        format: { type: 'string', enum: ['prd', 'agents', 'claude', 'cursor', 'prompt'], description: 'Default prd' },
      },
      required: ['id'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'explain_file',
    description: 'Reverse-trace a repository file path back to the PRD features (F-n), requirements (R-n/H-n), verified user quotes (E-n), and done criteria that depend on it.',
    inputSchema: projectSchema({ path: { type: 'string', description: 'Repository-relative file path, e.g. src/notes.ts' } }, ['path']),
    annotations: READ_ONLY,
  },
  {
    name: 'resume_project',
    description: 'Resume a project with its locked goal, connected repository, build status, recent decisions and last handoff.',
    inputSchema: projectSchema(),
    annotations: READ_ONLY,
  },
  {
    name: 'connect_repo',
    description: 'Connect a public GitHub repository (owner/repo) to the project using Seedup’s server credentials.',
    inputSchema: projectSchema({ repo: { type: 'string', description: 'Public GitHub owner/repo' } }, ['repo']),
    annotations: { ...STATE_WRITE, openWorldHint: true },
  },
  {
    name: 'check_env',
    description: 'Compare key names found by the agent in the local environment with the project’s expected names. Send names only, never values or file contents.',
    inputSchema: projectSchema({ names: { type: 'array', maxItems: 100, items: { type: 'string', pattern: ENV_NAME.source } } }, ['names']),
    annotations: READ_ONLY,
  },
  {
    name: 'record_decision',
    description: 'Record a decision and why. Set scope_change=true for changes to the goal, success criteria or scope. Ask the user in the terminal before acting, then record their answer. Never include secrets.',
    inputSchema: projectSchema({
      title: { ...memoryLine, maxLength: 200 },
      why: memoryLine,
      rejected: memoryLines,
      agent: { ...memoryLine, maxLength: 80 },
      feature_ids: memoryLines,
      criterion_ids: memoryLines,
      scope_change: { type: 'boolean' },
      approval: { type: 'string', enum: [APPROVED, REJECTED], description: 'Use only after the user answers in the terminal' },
    }, ['title', 'why', 'agent', 'scope_change']),
    annotations: MEMORY_WRITE,
  },
  {
    name: 'save_handoff',
    description: 'Save a short handoff with the current and next task, cautions and unverified commit SHAs. Never include secrets.',
    inputSchema: projectSchema({
      agent: { ...memoryLine, maxLength: 80 },
      doing: memoryLine,
      next: memoryLine,
      cautions: memoryLines,
      unverified_shas: memoryLines,
    }, ['agent', 'doing', 'next']),
    annotations: MEMORY_WRITE,
  },
  {
    name: 'get_project_memory',
    description: 'Read the full entries for project decisions, handoffs and facts, newest first (limit per kind).',
    inputSchema: projectSchema({ limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 50 per kind' } }),
    annotations: READ_ONLY,
  },
] as const;

const projectPromptArguments = [
  { name: 'project', description: keyDescription },
  { name: 'slug', description: 'Alias for project' },
];

export const PROMPTS = [
  {
    name: 'discover-and-spec',
    description: 'Search verified developer pains on Seedup, compare top candidates and competitors, and generate an evidence-traced PRD.',
    arguments: [{ name: 'query', description: 'Topic or pain keywords to search', required: true }],
  },
  {
    name: 'build-next-feature',
    description: 'Start a focused coding session: fetch the next ready PRD feature, mark it in_progress, implement it, verify criteria, link the commit, and mark it done.',
    arguments: projectPromptArguments,
  },
  {
    name: 'pre-ship-audit',
    description: 'Audit build readiness before shipping: inspect unfinished or needs_recheck features and verify diffs against done criteria.',
    arguments: projectPromptArguments,
  },
  {
    name: 'why-this-file',
    description: 'Explain why a file exists in terms of PRD features, requirements, verified user quotes, and criteria that must not break when editing it.',
    arguments: [
      ...projectPromptArguments,
      { name: 'path', description: 'Repository-relative file path', required: true },
    ],
  },
] as const;

const STATIC_RESOURCES = [
  appResource,
  {
    uri: 'seedup://prds/active',
    name: 'Active Seedup PRDs',
    description: 'Saved PRDs owned by this user (opportunity PRDs and personal idea PRDs)',
    mimeType: 'text/markdown',
  },
  {
    uri: 'seedup://kept/recent',
    name: 'Recent kept references',
    description: 'Recently kept GitHub repos, articles, papers, and AI products on Seedup',
    mimeType: 'text/markdown',
  },
] as const;

/** Keyword search with no model call: words in name, problem and keywords; verified opportunities first. */
export function searchOpportunities(opportunities: Opportunity[], query: string, limit = 5) {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 2);
  return opportunities
    .map((item) => {
      const haystack = [item.name, item.problem, item.gap, ...item.keywords].join(' ').toLowerCase();
      return { item, hits: words.filter((word) => haystack.includes(word)).length };
    })
    .filter(({ hits }) => hits > 0 || !words.length)
    .sort((a, b) => b.hits - a.hits || Number(b.item.qualified) - Number(a.item.qualified) || b.item.evidence.length - a.item.evidence.length)
    .slice(0, Math.max(1, Math.min(10, limit)))
    .map(({ item }) => item);
}

function describe(item: Opportunity, siteUrl: string) {
  const url = item.slug.startsWith('prd:') ? projectPage(siteUrl, item.slug) : `${siteUrl}/opportunities/${item.slug}`;
  return `${item.name} (${item.slug}) — ${item.qualified ? 'verified' : 'below evidence bar'}, ${item.evidence.length} quotes on ${item.platforms.join(', ')}, ${item.directCount} direct competitors, status ${item.status}\n  ${item.problem}\n  ${url}`;
}

function describeQuote(item: Evidence, number: number) {
  return `E-${number} [${item.platform}] "${item.quote}" ${item.url}`;
}

/** Use the same numbered criteria in the checklist and in the tools that record completion. */
export function featureCriteria(spec: Spec, feature: Spec['features'][number]) {
  const served = [...spec.requirements, ...spec.hypotheses].filter((row) => feature.requirementIds.includes(row.id));
  const criteria = [...new Set([...served.flatMap((row) => row.acceptance ?? []), ...(feature.slots?.done ?? [])].map((line) => line.trim()).filter((line) => line && !OPEN_SLOT_MARKER.test(line)))];
  return criteria.length ? criteria : ['Confirm the feature works with a test or command.'];
}

function mentionsExclusion(goal: ProjectGoal | null | undefined, value: string) {
  const lower = value.toLowerCase();
  return goal?.outOfScope.some((item) => item.trim() && lower.includes(item.trim().toLowerCase())) ?? false;
}

export function pickNextTask(spec: Spec, progress: BuildProgress, goal?: ProjectGoal | null) {
  const features = spec.features.map((feature) => ({
    feature,
    status: progress[feature.id]?.status ?? 'todo',
    number: Number(feature.id.slice(2)),
  }));
  const pending = features.filter(({ status }) => status !== 'done' && status !== 'blocked');
  const ready = pending.filter(({ feature, number }) => !features.some((earlier) =>
    earlier.number < number && earlier.status !== 'done' &&
    earlier.feature.requirementIds.some((id) => feature.requirementIds.includes(id)),
  )).map((task) => ({
    ...task,
    evidence: [...new Set(spec.requirements.filter((row) => task.feature.requirementIds.includes(row.id)).flatMap((row) => row.evidence))],
  }));

  const contributions = goal ? featureContribution(spec, goal.criteria) : [];
  const ranks = new Map(contributions.map((row, index) => [row.featureId, index]));
  const priority = { needs_recheck: 0, in_progress: 1, improving: 1, todo: 2, done: 3, blocked: 3 };
  const next = ready.sort((a, b) => (ranks.get(a.feature.id) ?? 0) - (ranks.get(b.feature.id) ?? 0) ||
    priority[a.status] - priority[b.status] ||
    (a.status === 'todo' && b.status === 'todo' ? b.evidence.length - a.evidence.length : 0) ||
    a.number - b.number)[0];
  if (!next) {
    const why = !features.length ? 'This PRD has no features.'
      : pending.length ? 'Remaining features are waiting for earlier features that serve the same requirements.'
      : features.every(({ status }) => status === 'done') ? 'All features are done.'
      : 'The remaining features are blocked.';
    return { feature: null, why };
  }
  const { feature, status, evidence } = next;
  const linked = contributions[ranks.get(feature.id) ?? -1]?.criterionIds ?? [];
  const outsideScope = mentionsExclusion(goal, feature.title);
  let why: string;
  if (outsideScope) why = 'This feature mentions a locked exclusion. Confirm its scope before starting.';
  else if (goal && !linked.length) why = 'No success criterion is linked to this feature. Check its scope with the user before starting.';
  else if (status === 'needs_recheck') why = 'This feature needs a recheck.';
  else if (status !== 'todo') why = 'Resume work already underway.';
  else if (goal) why = `Ready to start. This feature contributes to ${linked.join(', ')}.`;
  else why = `Ready to start with ${evidence.length} distinct verified quotes. To-do features are ranked by quote count, then feature number.`;
  return { feature, status, evidence, why, scopeCheck: outsideScope || Boolean(goal && !linked.length) };
}

const oneLine = (value: string, max = 160) => value.replace(/\s+/g, ' ').trim().slice(0, max);

function recentDecisions(memory: ProjectMemory | undefined) {
  return (memory?.decisions ?? []).slice(0, 3).map((decision) =>
    oneLine(decision.title) + (decision.approved === true ? ` (${APPROVED})` : decision.approved === false ? ` (${REJECTED})` : ''));
}

async function projectContext(deps: McpDeps, key: ProjectKey) {
  // Legacy tools still work while the supervisor migration is being rolled out.
  const [goal, memory] = await Promise.all([
    deps.projectGoal?.(key).catch(() => null),
    deps.projectMemory?.(key, 3).catch(() => undefined),
  ]);
  return { goal, memory };
}

function contextText(goal: ProjectGoal | null | undefined, memory: ProjectMemory | undefined) {
  const decisions = recentDecisions(memory);
  const handoff = memory?.handoffs[0];
  return [
    goal && goalSummary(goal, 'en'),
    decisions.length && `Recent decisions\n${decisions.map((decision) => `- ${decision}`).join('\n')}`,
    handoff && `Last handoff (${oneLine(handoff.agent, 80)})\nCurrent: ${oneLine(handoff.doing)}\nNext: ${oneLine(handoff.next)}${handoff.cautions.length ? `\nCautions: ${oneLine(handoff.cautions.join('; '))}` : ''}${handoff.unverifiedShas.length ? `\nUnverified commits: ${oneLine(handoff.unverifiedShas.join(', '))}` : ''}`,
  ].filter(Boolean).join('\n\n');
}

async function nextTaskResult(opportunity: Opportunity, found: { input: SpecInput; spec: Spec } | null, deps: McpDeps): Promise<ToolResult> {
  const { slug } = opportunity;
  const [{ goal, memory }, savedProgress] = await Promise.all([projectContext(deps, slug), found ? deps.progress(slug) : undefined]);
  const context = contextText(goal, memory);
  const intro = context ? `Project: ${slug}\n\n${context}\n\n` : '';
  if (!found) return text(intro + (slug.startsWith('prd:')
    ? 'This saved PRD has no readable feature spec. Update it in Seedup.'
    : `No PRD for "${slug}" yet. Call generate_verified_prd first.`), true);
  const progress: BuildProgress = savedProgress ?? {};
  let cached = found;
  const task = pickNextTask(cached.spec, progress, goal);
  if (!task.feature) return text(`${intro}No next task for "${slug}". ${task.why}`);

  const { status, evidence, why } = task;
  let feature = task.feature;
  // The feature about to be built gets its readiness slots now if the PRD never had them, once; the PRD keeps them.
  if (!feature.slots && deps.fillSlots && !slug.startsWith('prd:')) {
    const filled = await deps.fillSlots(cached, feature.id).catch(() => null);
    const updated = filled?.spec.features.find((row) => row.id === feature.id);
    if (filled && updated?.slots) {
      cached = filled;
      feature = updated;
    }
  }
  const criteria = featureCriteria(cached.spec, feature);
  // The cache key ignores order, but E-n always refers to the order saved with the PRD.
  // Fall back to the pinned PRD's own stored evidence if the daily engine rotated a quote out of opportunity.evidence.
  const quotes = [...evidence].sort((a, b) => a - b).flatMap((number) => {
    const saved = cached.input.evidence[number - 1];
    const quote = (saved?.id ? opportunity.evidence.find((item) => item.id === saved.id) : undefined) ?? saved;
    return quote ? [describeQuote(quote, number)] : [];
  });
  const files = (await deps.featureFiles?.(slug))?.[feature.id] ?? [];
  const slots = SLOT_KEYS.map((key) => `- ${SLOT_LABELS_EN[key]}: ${feature.slots?.[key]?.join(' / ') || '(open question)'}`);
  const args = { slug, feature_id: feature.id };
  const checks = criteria.map((_, index) => ({ criterion: index + 1, passed: true, evidence: '' }));
  const note = progress[feature.id]?.note;
  const setup = peopleFirst(cached.spec, feature.id);
  return {
    ...text(`${intro}${setup}${feature.id} ${feature.title} [${status}]
${feature.detail}
${why}${task.scopeCheck ? `\n${ASK_USER}` : ''}${note ? `\nPrevious status note: ${note}` : ''}

Done when
${criteria.map((line, index) => `${index + 1}. ${line}`).join('\n')}

Readiness slots
${slots.join('\n')}

Verified quotes
${quotes.join('\n') || 'No verified quotes.'}

Related files
${files.join('\n') || '관련 파일 정보 없음'}

${task.scopeCheck ? 'After the user confirms the scope' : 'Start now'}
update_feature_status ${JSON.stringify({ ...args, status: 'in_progress' })}

After all criteria pass, fill each evidence field with the passing test or command and its result
update_feature_status ${JSON.stringify({ ...args, status: 'done', checks })}

If blocked, describe what is blocking work
update_feature_status ${JSON.stringify({ ...args, status: 'blocked', note: '<what is blocking work>' })}`),
    structuredContent: nextTaskCard(feature, why, criteria.length, quotes.length, files, goal ? goalSummary(goal, 'en') : undefined),
  };
}

/**
 * "Environment first" (plan 2-2 ①): setup only a person can do for this feature, ahead of the task, with the mock to
 * build against meanwhile. Key names only; the agent checks them with check_env and never asks for values.
 */
export function peopleFirst(spec: Spec, featureId: string) {
  const tasks = humanTasks(spec);
  const mine = tasks.filter((task) => task.unblocksFeatureIds.includes(featureId)).slice(0, 3);
  const decisions = tasks.filter((task) => task.category === 'decision').length;
  if (!mine.length) return '';
  return `People first (ask the user to do these; build against the mock meanwhile)
${mine.map((task) => `- ${task.id} ${task.title}${task.envVars.length ? ` (key names: ${task.envVars.join(', ')})` : ''}. Mock: ${task.mockContractHint}`).join('\n')}
Check key names with check_env; never ask for or store values.${decisions ? ` ${decisions} open decision${decisions === 1 ? '' : 's'} in the PRD.` : ''}

`;
}

type Check = { criterion: number; passed: boolean; evidence: string };

/**
 * Which criteria still lack a passing check with evidence. An agent's word that a feature works is not enough: each
 * criterion needs its own passing check, so the mark on the PRD page means the criteria were actually tried.
 */
export function unmetCriteria(criteria: string[], raw: unknown) {
  const checks = (Array.isArray(raw) ? raw : []).flatMap((row): Check[] => {
    const item = (row ?? {}) as Record<string, unknown>;
    const evidence = String(item.evidence ?? '').trim();
    return Number.isInteger(item.criterion) && evidence.length >= 3 ? [{ criterion: Number(item.criterion), passed: item.passed === true, evidence: evidence.slice(0, 200) }] : [];
  });
  const passing = new Map(checks.filter((check) => check.passed).map((check) => [check.criterion, check]));
  return { unmet: criteria.map((line, index) => ({ n: index + 1, line })).filter(({ n }) => !passing.has(n)), passing: [...passing.values()] };
}

export function renderChecklist(opportunity: Opportunity, spec: Spec, progress: BuildProgress, siteUrl: string, unlinkedCount?: number) {
  const done = spec.features.filter((feature) => progress[feature.id]?.status === 'done').length;
  const lines = spec.features.map((feature) => {
    const mark = progress[feature.id];
    const status = mark?.status ?? 'todo';
    const criteria = featureCriteria(spec, feature).map((line, index) => `    ${index + 1}. ${line}`).join('\n');
    return `- [${status === 'done' ? 'x' : ' '}] ${feature.id} ${feature.title} [${status}] (serves ${feature.requirementIds.join(', ') || '-'})
    ${feature.detail}
  Done when:
${criteria}${mark?.note ? `\n  Note: ${mark.note}` : ''}`;
  });
  return `Build checklist for ${opportunity.name} (${opportunity.slug}): ${done}/${spec.features.length} done${spec.draft ? ', hypothesis draft' : ''}${unlinkedCount === undefined ? '' : `\nUnlinked commits: ${unlinkedCount}.`}
Work on one feature at a time. Call update_feature_status with in_progress when starting and done or blocked when ending. For done, include one passing check with evidence per numbered criterion.
PRD page: ${projectPage(siteUrl, opportunity.slug)}

${lines.join('\n\n') || 'This PRD has no features.'}`;
}

/** One kept item as an agent reads it: what it is, why it was kept, and where to open it. Pure, for tests. */
export function renderKept(item: KeptItem) {
  return [`- [${item.type}] ${item.title}${item.extra ? ` (${item.extra})` : ''}`, item.note ? `  ${item.note}` : '', `  ${item.url}`, item.page !== item.url ? `  On Seedup: ${item.page}` : '', `  Kept ${item.savedAt.slice(0, 10)}`].filter(Boolean).join('\n');
}

/** The evidence the site and generate_verified_prd both build from, so all three read the same cached PRD. */
const prdEvidence = (opportunity: Opportunity) => opportunity.evidence.slice(0, PRD_MAX_EVIDENCE);

function unknownFeatures(ids: string[], spec: Spec) {
  return text('Unknown feature ids: ' + ids.join(', ') + '. Valid features: ' + (spec.features.map((row) => row.id).join(', ') || 'none') + '.', true);
}

function isRepoPath(file: unknown): file is string {
  return typeof file === 'string' && file.length > 0 && file.length <= 300
    && !file.includes('\0') && !/^(?:[/\\]|[a-z]:)/i.test(file) && !file.split(/[/\\]/).includes('..');
}

function normalizeRepoPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

/**
 * Resolves the active PRD for an opportunity slug: checks exact current-evidence cache first,
 * then falls back to the user's pinned dossier or latest cached PRD so daily quote updates never
 * break an active build session.
 */
async function resolveSpecForSlug(opportunity: Opportunity, deps: McpDeps): Promise<{ input: SpecInput; spec: Spec } | null> {
  // The user's pinned PRD comes first: a PRD regenerated after a new quote has different feature numbers.
  const pinned = deps.pinnedSpec ? await deps.pinnedSpec(opportunity.slug, opportunity) : null;
  if (pinned) return pinned;
  return deps.cachedSpec(prdEvidence(opportunity).map((item) => item.id));
}

function renderSavedPrdList(items: SavedPrdSummary[], siteUrl: string) {
  if (!items.length) return `No saved PRDs yet. Create and save one at ${siteUrl}/prd.`;
  return `${items.length} saved PRD${items.length === 1 ? '' : 's'}, newest first:\n\n${items.map((item) => [
    `- ${item.title} (id: ${item.id})`,
    item.opportunitySlug ? `  Opportunity slug: ${item.opportunitySlug}` : '  Personal idea PRD (no opportunity slug)',
    `  Project key: prd:${item.id}`,
    `  Evidence: ${item.evidenceCount} quote${item.evidenceCount === 1 ? '' : 's'} · Updated ${item.updatedAt.slice(0, 10)}`,
    `  Use: get_my_prd {"id":"${item.id}","format":"agents"}`,
  ].join('\n')).join('\n\n')}`;
}

function savedProject(saved: SavedPrdDetail, key: ProjectKey) {
  const parsed = parsePrdMarkdown(saved.prdMarkdown);
  const rivals = (parsed?.rivals ?? []) as SpecRival[];
  const publicQuotes = publicEvidence(saved.evidence);
  const platforms = [...new Set(publicQuotes.map((row) => row.platform))];
  const qualified = meetsEvidenceBar(publicQuotes.length, platforms.length);
  const spec = parsed && {
    ...normalizeSpec(parsed, saved.evidence, !qualified, { idea: !saved.opportunitySlug, competitorNotes: saved.competitorNotes }),
    rivals,
  };
  const input: SpecInput = {
    title: saved.title,
    problem: spec?.background || spec?.summary || saved.title,
    gap: '',
    evidence: saved.evidence,
    competitors: rivals.map((row) => row.name),
    competitorNotes: saved.competitorNotes,
  };
  const opportunity: Opportunity = {
    slug: key, name: input.title, problem: input.problem, gap: input.gap, keywords: [], status: 'unknown',
    qualified, platforms, evidence: input.evidence, directCount: rivals.length, firstSeenAt: null, followersAfterSignal: 0,
    supply: rivals.map((row) => ({ kind: 'web', name: row.name, description: row.misses, url: '', popularity: 0, createdAt: null, relation: 'direct' })),
  };
  return { opportunity, result: spec ? { input, spec } : null };
}

async function renderMcpBrief(input: SpecInput, spec: Spec, format: ExportFormat, key: ProjectKey, deps: McpDeps) {
  const { goal, memory } = format === 'agents' ? await projectContext(deps, key) : {};
  return `Save as ${EXPORT_FILES[format]}:\n\n${renderAgentBrief(input, spec, format, key, { goal, decisions: recentDecisions(memory) })}`;
}

async function explainFileResult(opportunity: Opportunity, cached: { input: SpecInput; spec: Spec }, rawPath: unknown, deps: McpDeps): Promise<ToolResult> {
  const normalized = typeof rawPath === 'string' ? normalizeRepoPath(rawPath) : '';
  if (!isRepoPath(normalized)) return text('Provide a repository-relative file path (1–300 characters, no ".." segments).', true);

  const [progress, linked] = await Promise.all([deps.progress(opportunity.slug), deps.featureFiles(opportunity.slug)]);
  const matchingFeatureIds = Object.entries(linked)
    .filter(([, files]) => files.some((file) => normalizeRepoPath(file) === normalized))
    .map(([featureId]) => featureId);

  if (!matchingFeatureIds.length) {
    return text(`No linked feature touches "${normalized}" in "${opportunity.slug}" yet. Call link_commit after commits so Seedup can map files back to PRD features and verified quotes.`);
  }

  const allReqs = new Map([...cached.spec.requirements, ...cached.spec.hypotheses].map((row) => [row.id, row]));
  const sections = matchingFeatureIds.flatMap((featureId) => {
    const feature = cached.spec.features.find((row) => row.id === featureId);
    if (!feature) return [];
    const status = progress[feature.id]?.status ?? 'todo';
    const served = feature.requirementIds.flatMap((rid) => {
      const row = allReqs.get(rid);
      return row ? [row] : [];
    });
    const quoteNumbers = [...new Set(served.flatMap((row) => row.evidence))].sort((a, b) => a - b);
    const quotes = quoteNumbers.flatMap((number) => {
      const saved = cached.input.evidence[number - 1];
      const quote = (saved?.id ? opportunity.evidence.find((item) => item.id === saved.id) : undefined) ?? saved;
      return quote ? [describeQuote(quote, number)] : [];
    });
    const criteria = featureCriteria(cached.spec, feature);
    return [[
      `## ${feature.id} ${feature.title} [${status}]`,
      feature.detail,
      '',
      'Requirements served:',
      ...(served.length
        ? served.map((row) => `- ${row.id}${row.priority ? ` [${row.priority}]` : ''} ${row.title}: ${row.detail}`)
        : ['- (none)']),
      '',
      'Verified quotes:',
      ...(quotes.length ? quotes.map((line) => `- ${line}`) : ['- No verified quotes (hypothesis)']),
      '',
      'Done criteria to re-check if you modify this file:',
      ...criteria.map((line, index) => `${index + 1}. ${line}`),
    ].join('\n')];
  });

  if (!sections.length) {
    return text(`Commits touching "${normalized}" exist, but none match a feature in the active PRD for "${opportunity.slug}".`);
  }

  return text(`Reverse trace for "${normalized}" in ${opportunity.name} (${opportunity.slug}):\n\n${sections.join('\n\n')}`);
}

const OPPORTUNITY_TOOLS = new Set([
  'get_opportunity',
  'generate_verified_prd',
  'get_build_checklist',
  'get_next_task',
  'update_feature_status',
  'mark_feature_done',
  'link_commit',
  'verify_feature',
  'explain_file',
]);

const SUPERVISOR_TOOLS = new Set(['resume_project', 'connect_repo', 'check_env', 'record_decision', 'save_handoff', 'get_project_memory']);

function projectKey(args: Record<string, unknown>): ProjectKey | null {
  const keys = [args.project, args.slug].filter((key) => key !== undefined).map((key) => {
    if (typeof key !== 'string') return null;
    const value = key.trim();
    if (/^prd:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return value.toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value) ? value : null;
  });
  return keys.length && keys.every((key) => key === keys[0]) ? keys[0] : null;
}

// shortcut: free-text checks catch recognizable credentials; use a dedicated secret scanner if memory accepts code or logs.
const SECRET_PATTERNS = [
  /\b[A-Z][A-Z0-9_]*\s*=\s*\S/,
  /\b[\w-]*(?:api[_-]?key|token|secret|password|credential|database[_-]?url)[\s"'\`]*[:=]\s*\S/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bbearer\s+[\w.+/=-]+|\w+:\/\/[^\s/:]+:[^\s/@]+@/i,
  /\b(?:gh[pousr]_|github_pat_|sk-|sk_live_|sb_secret_|xox[baprs]-|re_)[\w-]{12,}/i,
  /\b(?:sdp_[a-f0-9]{48}|(?:akia|asia)[a-z0-9]{16}|eyJ[\w-]+\.[\w-]+\.[\w-]+)/i,
];
const hasSecret = (value: string) => SECRET_PATTERNS.some((pattern) => pattern.test(value));

function safeMemoryLine(value: unknown, max = 500) {
  if (typeof value !== 'string') return null;
  const line = value.trim();
  return line && line.length <= max && !line.includes('\0') && !hasSecret(line) ? line : null;
}

function memoryList(value: unknown, pattern?: RegExp): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) return null;
  const lines = value.map((item: unknown) => safeMemoryLine(item));
  return lines.every((line): line is string => line !== null && (!pattern || pattern.test(line))) ? lines : null;
}

async function callSupervisorTool(name: string, args: Record<string, unknown>, opportunity: Opportunity, deps: McpDeps, loadSpec: () => Promise<{ input: SpecInput; spec: Spec } | null>) {
  const key = opportunity.slug;
  if (name === 'resume_project') {
    const [project, goal, memory, progress] = await Promise.all([
      deps.supervisorProject?.(key), deps.projectGoal?.(key), deps.projectMemory?.(key, 3), deps.progress(key),
    ]);
    const working = Object.entries(progress).filter(([, row]) => ['in_progress', 'improving', 'blocked', 'needs_recheck'].includes(row.status));
    return text([
      `${opportunity.name} (project: ${key})`,
      project?.repo ? `Repository: ${project.repo}` : 'Repository: not connected',
      !goal && 'No locked goal yet.',
      contextText(goal, memory),
      working.length && `Active features: ${working.slice(0, 5).map(([id, row]) => `${id} [${row.status}]`).join(', ')}`,
      `Continue with get_next_task ${JSON.stringify({ project: key })}.`,
    ].filter(Boolean).join('\n\n'));
  }
  if (name === 'connect_repo') {
    const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
    const [owner, repository, extra] = repo.split('/');
    if (!isGitHubLogin(owner) || !repository || !/^[a-z\d_.-]{1,100}$/i.test(repository) || /^\.+$/.test(repository) || extra !== undefined) {
      return text('Provide a public GitHub repository as owner/repo.', true);
    }
    const connected = await deps.connectRepo?.(key, repo);
    return connected ? text(`Connected ${connected} to ${key}.`) : text('Could not verify a public GitHub repository. Check the name or try again later.', true);
  }
  if (name === 'check_env') {
    const { names } = args;
    if (Object.keys(args).some((field) => !['project', 'slug', 'names'].includes(field)) ||
      !Array.isArray(names) || names.length > 100 || !names.every((item) => typeof item === 'string' && ENV_NAME.test(item) && !hasSecret(item))) {
      return text('Send only bare environment key names in names. Never send values or file contents.', true);
    }
    const [cached, memory] = await Promise.all([loadSpec(), deps.projectMemory?.(key, 50)]);
    const expected = [...new Set([
      ...(cached ? humanTasks(cached.spec).flatMap((task) => task.envVars) : []),
      ...(memory?.facts ?? []).filter((fact) => fact.kind === 'env_name' && ENV_NAME.test(fact.text)).map((fact) => fact.text),
    ])];
    const reported = new Set(names);
    const present = expected.filter((env) => reported.has(env));
    const missing = expected.filter((env) => !reported.has(env));
    return text(expected.length
      ? `Based on names reported from the local environment:\nPresent: ${present.join(', ') || 'none'}\nMissing: ${missing.join(', ') || 'none'}`
      : 'No required environment key names are known for this project yet.');
  }
  if (name === 'get_project_memory') {
    const limit = args.limit ?? 50;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) return text('Limit must be an integer from 1 to 100.', true);
    const memory = await deps.projectMemory?.(key, limit);
    return memory ? text(JSON.stringify(memory, null, 2)) : text('Project memory is unavailable.', true);
  }
  if (!deps.addProjectMemory) return text('Project memory is unavailable.', true);
  const agent = safeMemoryLine(args.agent, 80);
  if (!agent) return text('Provide a short agent name and leave secrets out of project memory.', true);
  if (name === 'save_handoff') {
    const doing = safeMemoryLine(args.doing);
    const next = safeMemoryLine(args.next);
    const cautions = memoryList(args.cautions);
    const unverifiedShas = memoryList(args.unverified_shas, /^[a-f0-9]{7,40}$/i);
    if (!doing || !next || !cautions || !unverifiedShas) return text('Provide short handoff notes and valid unverified commit SHAs. Leave secrets out.', true);
    await deps.addProjectMemory(key, { kind: 'handoff', body: { agent, doing, next, cautions, unverifiedShas } });
    return text(`Saved handoff for ${key}.`);
  }

  const title = safeMemoryLine(args.title, 200);
  const why = safeMemoryLine(args.why);
  const rejected = memoryList(args.rejected);
  const featureIds = memoryList(args.feature_ids, /^F-\d{1,3}$/);
  const criterionIds = memoryList(args.criterion_ids, /^G-\d{1,3}$/);
  const approval = args.approval;
  if (!title || !why || !rejected || !featureIds || !criterionIds || typeof args.scope_change !== 'boolean' ||
    (approval !== undefined && approval !== APPROVED && approval !== REJECTED)) {
    return text('Provide title, why, agent and scope_change, with valid feature or criterion ids if applicable. Leave secrets out.', true);
  }
  const goal = await deps.projectGoal?.(key);
  // The agent declares semantic changes; exact mentions of locked exclusions also require explicit review.
  const scopeChange = args.scope_change || mentionsExclusion(goal, title);
  const approved = approval === undefined ? null : approval === APPROVED;
  const body: Omit<Decision, 'id' | 'projectKey' | 'at'> = {
    title, why, rejected, goalVersion: goal?.version ?? 0, author: { kind: 'agent', name: agent }, approved, featureIds, criterionIds,
  };
  const saved = await deps.addProjectMemory(key, { kind: 'decision', body });
  const note = scopeChange && approved === null ? ASK_USER
    : approval === APPROVED && scopeChange ? `${APPROVED}. Have the user lock the revised goal before implementing the change.`
    : approval ?? '';
  return text(`Recorded decision ${saved.id} for ${key}.${note ? `\n${note}` : ''}`);
}

async function callTool(name: string, args: Record<string, unknown>, deps: McpDeps, siteUrl: string): Promise<ToolResult> {
  // Handle user-scoped tools first without loading the full opportunity catalog.
  if (name === 'list_my_prds') {
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 20) || 20));
    const items = deps.myPrds ? await deps.myPrds(limit) : [];
    return text(renderSavedPrdList(items, siteUrl));
  }
  if (name === 'get_my_prd') {
    const id = String(args.id ?? '').trim();
    if (!id) return text('Provide the saved PRD id (from list_my_prds).', true);
    const saved = deps.myPrd ? await deps.myPrd(id) : null;
    if (!saved) return text(`Saved PRD "${id}" not found. Call list_my_prds first.`, true);
    const format = (['prd', 'agents', 'claude', 'cursor', 'prompt'].includes(String(args.format)) ? String(args.format) : 'prd') as ExportFormat | 'prd';
    if (format === 'prd') return text(saved.prdMarkdown);
    const key = saved.opportunitySlug ?? `prd:${saved.id}`;
    const { result } = savedProject(saved, key);
    return text(result ? await renderMcpBrief(result.input, result.spec, format, key, deps) : saved.prdMarkdown);
  }
  if (name === 'get_kept_items') {
    const type = (KEPT_TYPES as readonly string[]).includes(String(args.type)) ? (String(args.type) as KeptType) : null;
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 20) || 20));
    const items = await deps.kept(type, limit);
    if (!items.length) return text(type === 'github' ? `No kept repositories yet. Keep one from ${siteUrl}/github-trends.` : `Nothing kept yet. Keep repositories and articles on ${siteUrl}/news.`);
    return text(`${items.length} kept item${items.length === 1 ? '' : 's'}, newest first:\n\n${items.map(renderKept).join('\n\n')}`);
  }
  if (name === 'validate_idea') {
    const idea = String(args.idea ?? '').trim().slice(0, 300);
    if (idea.length < 4) return text('Describe the idea in a sentence.', true);
    if (!(await deps.consume('mcp_report', MCP_DAILY_REPORT_LIMIT))) return text(`Daily limit reached (${MCP_DAILY_REPORT_LIMIT} reports). Try again tomorrow.`, true);
    let report: string | null = null;
    try {
      report = await deps.validate(idea);
    } catch (error) {
      await deps.release?.('mcp_report').catch(() => undefined);
      throw error;
    }
    if (!report) {
      await deps.release?.('mcp_report').catch(() => undefined);
      return text('The report could not be made. Try again in a minute.', true);
    }
    return text(report);
  }
  if (name === 'watch_idea') {
    const idea = String(args.idea ?? '').trim().slice(0, 300);
    if (idea.length < 4) return text('Describe the idea in a sentence.', true);
    return (await deps.watch(idea))
      ? text(`Watching "${idea}". Seedup checks it once a week and mails new quotes or rival tools. Stop it at ${siteUrl}/profile.`)
      : text('Could not start the watch (the limit is 10 ideas, or the database is not set up yet).', true);
  }
  if (name === 'find_related_content') {
    const idea = String(args.idea ?? '').trim().slice(0, 500);
    if (idea.length < 5) return text('Describe the idea in a sentence.', true);
    const rows = await deps.related(idea);
    return text(rows.length ? rows.map((row) => `- ${row.title} (${row.source}, similarity ${row.similarity.toFixed(2)})${row.url ? ` ${row.url}` : ''}`).join('\n') : 'Nothing Seedup collected is close to this idea.');
  }

  if (name === 'search_opportunities') {
    const found = searchOpportunities(await deps.opportunities(), String(args.query ?? ''), Number(args.limit ?? 5));
    if (!found.length) return text('No opportunity matched. Try broader words.');
    return { ...text(found.map((item) => describe(item, siteUrl)).join('\n\n')), structuredContent: opportunitiesCard(found, siteUrl) };
  }
  if (!OPPORTUNITY_TOOLS.has(name) && !SUPERVISOR_TOOLS.has(name)) return text(`Unknown tool "${name}".`, true);
  const slug = projectKey(args);
  if (!slug) return text('Provide a project key (public opportunity slug or prd:<id>) as project or slug. Both aliases must agree when present.', true);
  const personal = slug.startsWith('prd:');
  const saved = personal ? await deps.myPrd?.(slug.slice(4)) : null;
  const savedBuild = saved ? savedProject(saved, slug) : null;
  const opportunities = personal ? [] : await deps.opportunities();
  const opportunity = personal ? savedBuild?.opportunity : opportunities.find((item) => item.slug === slug);
  if (!opportunity) return text(`Project "${slug}" not found. Call search_opportunities or list_my_prds first.`, true);
  const loadSpec = () => personal ? Promise.resolve(savedBuild?.result ?? null) : resolveSpecForSlug(opportunity, deps);
  if (SUPERVISOR_TOOLS.has(name)) return callSupervisorTool(name, args, opportunity, deps, loadSpec);
  const updatesProgress = name === 'update_feature_status' || name === 'mark_feature_done';
  const needsPrd = ['get_build_checklist', 'get_next_task', 'verify_feature', 'explain_file'].includes(name) || updatesProgress;
  if (name === 'get_opportunity') {
    const quotes = opportunity.evidence.map((item, index) => describeQuote(item, index + 1)).join('\n');
    const rivals = opportunity.supply.filter((item) => item.relation === 'direct').map((item) => `- ${item.name}${item.url ? ` ${item.url}` : ''}`).join('\n');
    return text(`${describe(opportunity, siteUrl)}\n\nGap: ${opportunity.gap || 'unknown'}\n\nVerified quotes:\n${quotes}\n\nDirect competitors:\n${rivals || '- none found'}`);
  }
  if (name === 'generate_verified_prd') {
    const format = (['agents', 'claude', 'cursor', 'prompt', 'prd'].includes(String(args.format)) ? String(args.format) : 'agents') as ExportFormat | 'prd';
    if (saved) {
      if (args.fresh) return text('This is a saved PRD. Edit it in Seedup to change the spec.', true);
      const result = savedBuild?.result;
      const body = format === 'prd' || !result ? saved.prdMarkdown : await renderMcpBrief(result.input, result.spec, format, slug, deps);
      return { ...text(body), ...(result ? { structuredContent: prdCard(opportunity, result.spec, siteUrl) } : {}) };
    }
    const picked = prdEvidence(opportunity).map((evidence) => ({ evidence, slug }));
    const ids = picked.map((item) => item.evidence.id);
    let result = args.fresh ? null : await deps.cachedSpec(ids);
    if (!result) {
      const input = specInputFor(opportunities, picked);
      if (!input) return text('This opportunity has no quotes yet.', true);
      if (!(await deps.consume('mcp_prd', MCP_DAILY_PRD_LIMIT))) return text(`Daily limit reached (${MCP_DAILY_PRD_LIMIT} PRDs). Try again tomorrow.`, true);
      const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
      let spec: Spec | null = null;
      try {
        spec = await deps.generate(input, draft);
      } catch (error) {
        await deps.release?.('mcp_prd').catch(() => undefined);
        throw error;
      }
      if (!spec) {
        await deps.release?.('mcp_prd').catch(() => undefined);
        return text('The model did not answer. Try again in a minute.', true);
      }
      result = { input, spec };
    }
    result = { ...result, spec: withPrdReadiness(result.spec) };
    // The PRD an agent builds from is pinned to this user, so tomorrow's engine run cannot shift its feature numbers.
    await deps.pin?.(slug, result, Boolean(args.fresh)).catch(() => undefined);
    const body = format === 'prd' ? renderSpecMarkdown(result.input, result.spec) : await renderMcpBrief(result.input, result.spec, format, slug, deps);
    return { ...text(body), structuredContent: prdCard(opportunity, result.spec, siteUrl) };
  }
  if (name === 'link_commit') {
    const { sha, message, files, features } = args;
    if (typeof sha !== 'string' || !/^[a-f0-9]{7,40}$/i.test(sha)) return text('SHA must be 7–40 hexadecimal characters.', true);
    if (typeof message !== 'string' || message.length > 500 || message.includes('\0')) return text('Message must be a string of at most 500 characters without null bytes.', true);
    if (!Array.isArray(files) || files.length > 200 || !files.every(isRepoPath)) return text('Provide up to 200 repository-relative file paths, each 1–300 characters and without ".." path segments.', true);
    if (features !== undefined && (!Array.isArray(features) || !features.every((id) => typeof id === 'string'))) return text('Features must be an array of feature ids.', true);
    const rawIds: string[] = features ?? message.match(/\bf-?\d+\b/gi) ?? [];
    const featureIds = new Set<string>();
    if (rawIds.length) {
      const cached = await loadSpec();
      if (!cached) return text(`No PRD for "${slug}" yet. Call generate_verified_prd first.`, true);
      const validIds = new Set(cached.spec.features.map((row) => row.id));
      const unknown = new Set<string>();
      for (const rawId of rawIds) {
        const id = normalizeFeatureId(rawId);
        if (id && validIds.has(id)) featureIds.add(id);
        else unknown.add(rawId);
      }
      if (unknown.size) return unknownFeatures([...unknown], cached.spec);
    }
    const commitSha = sha.toLowerCase();
    await deps.linkCommit(slug, { sha: commitSha, message, files, featureIds: [...featureIds] });
    const lines = [featureIds.size ? 'Recorded commit for ' + [...featureIds].join(', ') + '.' : 'Recorded commit without a feature link.'];
    if (!files.length) return text(lines[0]);

    try {
      const [progress, linkedFiles] = await Promise.all([deps.progress(slug), deps.featureFiles(slug, commitSha)]);
      for (const feature of touchedDoneFeatures(progress, linkedFiles, files, featureIds)) {
        try {
          const flagged = await deps.flagRecheck(slug, feature.id, commitSha, `Commit ${commitSha} touched ${feature.files.join(', ')}.`);
          if (flagged) lines.push(`${feature.id} is now needs_recheck: re-run its done criteria (get_build_checklist), then update_feature_status done with checks.`);
        } catch (error) {
          console.error('MCP feature recheck write failed', error);
          lines.push(`Could not flag ${feature.id} for recheck. Retry link_commit.`);
        }
      }
    } catch (error) {
      console.error('MCP feature recheck lookup failed', error);
      lines.push('Could not check for affected features. Retry link_commit.');
    }
    return text(lines.join('\n'));
  }
  if (needsPrd) {
    const cached = await loadSpec();
    if (name === 'get_next_task') return nextTaskResult(opportunity, cached, deps);
    if (!cached) return text(personal ? 'This saved PRD has no readable feature spec. Update it in Seedup.' : `No PRD for "${slug}" yet. Call generate_verified_prd first.`, true);
    if (name === 'explain_file') {
      return explainFileResult(opportunity, cached, args.path, deps);
    }
    if (name === 'verify_feature') {
      const { diff } = args;
      if (typeof diff !== 'string' || !diff.trim()) return text('Provide a non-empty diff.', true);
      const rawId = typeof args.feature === 'string' ? args.feature : '';
      const id = normalizeFeatureId(rawId);
      const feature = cached.spec.features.find((row) => row.id === id);
      if (!feature) return unknownFeatures([rawId || '(missing)'], cached.spec);
      if (!(await deps.consume('mcp_verify', 10))) return text('Daily limit reached (10 feature reviews). Try again tomorrow.', true);

      const criteria = featureCriteria(cached.spec, feature).map((criterion, index) => ({ number: index + 1, criterion }));
      let review: { checks?: Array<{ number: number; status: string; reason: string } | null> } | null = null;
      try {
        review = await deps.verifyFeature(JSON.stringify({
          criteria, diff: diff.slice(0, 20_000), truncated: diff.length > 20_000,
        })) as { checks?: Array<{ number: number; status: string; reason: string } | null> } | null;
      } catch (error) {
        await deps.release?.('mcp_verify').catch(() => undefined);
        throw error;
      }
      if (!Array.isArray(review?.checks) || !review.checks.length) {
        await deps.release?.('mcp_verify').catch(() => undefined);
        return text('The model did not return a review. Try again in a minute.', true);
      }
      const checks = new Map(review.checks.map((row) => [row?.number, row]));
      const lines = criteria.map(({ number, criterion }) => {
        const check = checks.get(number);
        const reason = typeof check?.reason === 'string' ? check.reason.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
        if (check && reason && ['met', 'not met', 'unclear'].includes(check.status)) return number + '. ' + criterion + ' — ' + check.status + '. ' + reason;
        return number + '. ' + criterion + ' — unclear. No usable assessment for this criterion.';
      });
      return text('Model opinion for ' + feature.id + '. Feature status is unchanged.'
        + (diff.length > 20_000 ? ' Reviewed the first 20,000 characters of the diff.' : '') + '\n\n' + lines.join('\n'));
    }
    if (updatesProgress) {
      const alias = name === 'mark_feature_done';
      const rawStatus = alias ? (args.done === false ? 'todo' : 'done') : args.status;
      if (rawStatus === 'needs_recheck') return text('Status "needs_recheck" is server-only.', true);
      const status = AGENT_FEATURE_STATUSES.find((value) => value === rawStatus);
      if (!status) return text(`Invalid status. Use one of: ${AGENT_FEATURE_STATUSES.join(', ')}.`, true);

      const rawId = String((alias ? args.feature : args.feature_id) ?? '');
      const id = normalizeFeatureId(rawId);
      const feature = id ? cached.spec.features.find((row) => row.id === id) : undefined;
      if (!feature) return text(`Unknown feature "${rawId}". Features: ${cached.spec.features.map((row) => row.id).join(', ') || 'none'}.`, true);
      let note = String(args.note ?? '').trim();
      if (status === 'done') {
        const criteria = featureCriteria(cached.spec, feature);
        const { unmet, passing } = unmetCriteria(criteria, args.checks);
        if (unmet.length) return text(`${feature.id} is not marked done: ${unmet.length} of ${criteria.length} criteria have no passing check.\n${unmet.map(({ n, line }) => `  ${n}. ${line}`).join('\n')}\nCheck each one (a test or a command), then call ${name} again with checks: [{ criterion, passed: true, evidence }].`, true);
        const proof = passing.map((check) => `${check.criterion}: ${check.evidence}`).join('; ');
        note = [note, `checks ${passing.length}/${criteria.length} (${proof})`].filter(Boolean).join(' · ');
      }
      const enteredBlocked = await deps.setProgress(slug, feature, status, note);
      if (status === 'blocked' && enteredBlocked) {
        try {
          await deps.notifyBlocked(opportunity, feature);
        } catch {
          // The progress update has already been saved.
        }
      }
    }
    const [progress, unlinkedCount] = await Promise.all([
      deps.progress(slug),
      name === 'get_build_checklist' ? deps.unlinkedCommitCount(slug) : undefined,
    ]);
    return { ...text(renderChecklist(opportunity, cached.spec, progress, siteUrl, unlinkedCount)), structuredContent: checklistCard(opportunity, cached.spec, progress, (feature) => featureCriteria(cached.spec, feature), siteUrl) };
  }
  return text(`Unknown tool "${name}".`, true);
}

async function readResource(uri: unknown, deps: McpDeps, siteUrl: string) {
  const app = readAppResource(uri);
  if (app) return app;
  if (uri === 'seedup://prds/active') {
    const items = deps.myPrds ? await deps.myPrds(20) : [];
    return { contents: [{ uri, mimeType: 'text/markdown', text: renderSavedPrdList(items, siteUrl) }] };
  }
  if (uri === 'seedup://kept/recent') {
    const items = await deps.kept(null, 20);
    const body = items.length ? items.map(renderKept).join('\n\n') : `Nothing kept yet. Keep references on ${siteUrl}/news.`;
    return { contents: [{ uri, mimeType: 'text/markdown', text: body }] };
  }
  return null;
}

function getPromptResult(name: string, rawArgs: Record<string, unknown>) {
  const str = (key: string) => String(rawArgs[key] ?? '').trim();
  if (name === 'discover-and-spec') {
    const query = str('query');
    if (!query) return { error: 'Missing required argument: query' };
    return {
      result: {
        description: 'Search verified opportunities and draft an evidence-traced PRD',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Use Seedup MCP tools to research "${query}":\n1. Call search_opportunities with {"query":${JSON.stringify(query)},"limit":5}.\n2. Pick the strongest verified opportunity and call get_opportunity on its slug to review every quote and direct competitor.\n3. Call generate_verified_prd for that slug with format "agents" (or "claude" if working in Claude Code) and summarize the P0 scope and evidence links.`,
          },
        }],
      },
    };
  }
  if (name === 'build-next-feature') {
    const slug = projectKey(rawArgs);
    if (!slug) return { error: 'Provide the project key as project or slug.' };
    return {
      result: {
        description: 'Implement the next ready PRD feature end-to-end with verified checks',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Run a focused Seedup build loop for "${slug}":\n1. Call get_next_task {"slug":${JSON.stringify(slug)}}.\n2. Call update_feature_status with status "in_progress" for the returned feature_id.\n3. Implement the feature following its readiness slots and verified quotes.\n4. Run tests/commands verifying every numbered done criterion (and optionally call verify_feature with git diff).\n5. Call link_commit if commit linking is enabled, then update_feature_status with status "done" and passing checks for every criterion.`,
          },
        }],
      },
    };
  }
  if (name === 'pre-ship-audit') {
    const slug = projectKey(rawArgs);
    if (!slug) return { error: 'Provide the project key as project or slug.' };
    return {
      result: {
        description: 'Verify build readiness and re-check modified features before shipping',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Audit ship readiness for "${slug}":\n1. Call get_build_checklist {"slug":${JSON.stringify(slug)}} and check for any features in needs_recheck, blocked, or todo.\n2. For any needs_recheck or recently changed feature, collect its git diff and call verify_feature against its done criteria.\n3. Report which features are verified ready, which criteria failed or remain unclear, and whether any unlinked commits need review.`,
          },
        }],
      },
    };
  }
  if (name === 'why-this-file') {
    const slug = projectKey(rawArgs);
    const path = str('path');
    if (!slug) return { error: 'Provide the project key as project or slug.' };
    if (!path) return { error: 'Missing required argument: path' };
    return {
      result: {
        description: 'Explain which user quotes and PRD criteria depend on a file',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Before modifying "${path}" in "${slug}", call explain_file {"slug":${JSON.stringify(slug)},"path":${JSON.stringify(path)}} and summarize: (1) which PRD features and requirements depend on this file, (2) the underlying verified user pain quotes (E-n), and (3) every done criterion that must still pass after edits.`,
          },
        }],
      },
    };
  }
  return null;
}

async function activeGoalInstructions(deps: McpDeps) {
  if (!deps.myPrds || !deps.projectGoal) return '';
  // shortcut: use recent saved PRDs to discover keys; switch to a user-wide goal query when the DB layer provides one.
  const saved = await deps.myPrds(5).catch(() => []);
  const keys = [...new Set(saved.flatMap((prd) => [`prd:${prd.id}`, ...(prd.opportunitySlug ? [prd.opportunitySlug] : [])]))];
  const fetchGoal = deps.projectGoal;
  const goals = (await Promise.all(keys.map((key) => fetchGoal(key).catch(() => null))))
    .filter((goal): goal is ProjectGoal => Boolean(goal?.criteria.some((criterion) => criterion.status !== 'met')))
    .sort((a, b) => b.lockedAt.localeCompare(a.lockedAt))
    .slice(0, 2);
  return goals.length ? `\n\nActive locked goals from recent PRDs:\n${goals.map((goal) => `- ${goal.projectKey} (v${goal.version}): ${oneLine(goal.statement, 300)}`).join('\n')}` : '';
}

async function handleOne(message: RpcRequest, deps: McpDeps, siteUrl: string) {
  const id = message.id ?? null;
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const fail = (code: number, errorMessage: string) => ({ jsonrpc: '2.0', id, error: { code, message: errorMessage } });
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return fail(-32600, 'Invalid request');
  // Notifications have no id and get no answer.
  if (message.id === undefined) return null;
  switch (message.method) {
    case 'initialize': {
      const asked = String(message.params?.protocolVersion ?? '');
      return reply({
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: 'seedup', version: '1.1.0' },
        instructions: 'Seedup finds build opportunities from verified quotes and turns them into evidence-traced PRDs. Search first, then generate_verified_prd and save the result in the repo (or call list_my_prds / get_my_prd for saved personal PRDs). At the start of each build session, call get_next_task with project (a public slug or prd:<id>) and build one feature at a time. Use update_feature_status to report in_progress when starting and done with checks or blocked when ending, and explain_file before editing files linked to done features. Ask the user in the terminal about goal or scope changes and use record_decision to record the answer.'
          + await activeGoalInstructions(deps),
      });
    }
    case 'ping':
      return reply({});
    case 'resources/list':
      return reply({ resources: [...STATIC_RESOURCES] });
    case 'resources/read': {
      const resource = await readResource(message.params?.uri, deps, siteUrl);
      return resource ? reply(resource) : fail(-32002, `Resource not found: ${String(message.params?.uri ?? '')}`);
    }
    case 'resources/templates/list':
      return reply({ resourceTemplates: [] });
    case 'prompts/list':
      return reply({ prompts: [...PROMPTS] });
    case 'prompts/get': {
      const promptName = String(message.params?.name ?? '');
      const promptArgs = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const outcome = getPromptResult(promptName, promptArgs);
      if (!outcome) return fail(-32602, `Prompt not found: ${promptName}`);
      if ('error' in outcome && outcome.error) return fail(-32602, outcome.error);
      return reply(outcome.result);
    }
    case 'tools/list':
      return reply({ tools: withAppMeta(TOOLS) });
    case 'tools/call': {
      const name = String(message.params?.name ?? '');
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        return reply(await callTool(name, args, deps, siteUrl));
      } catch (error) {
        console.error('MCP tool failed', name, error);
        return reply(text('The tool failed. Try again.', true));
      }
    }
    default:
      return fail(-32601, `Method not found: ${message.method}`);
  }
}

/** One JSON-RPC message or a batch. Returns null when only notifications came in (the route answers 202). */
export async function handleRpc(body: unknown, deps: McpDeps, siteUrl: string) {
  if (Array.isArray(body)) {
    if (!body.length) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    if (body.length > MCP_MAX_BATCH_SIZE) {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: `Batch size exceeds limit of ${MCP_MAX_BATCH_SIZE}` } };
    }
    const answers = (await Promise.all(body.map((item) => handleOne((item ?? {}) as RpcRequest, deps, siteUrl)))).filter(Boolean);
    return answers.length ? answers : null;
  }
  if (!body || typeof body !== 'object') return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
  return handleOne(body as RpcRequest, deps, siteUrl);
}
