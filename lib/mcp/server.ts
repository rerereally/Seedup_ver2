// Seedup as an MCP server (Streamable HTTP, JSON responses only). The transport is plain JSON-RPC 2.0, so this file
// has no dependency: the route hands it the parsed body and a context with the data sources it may use.
import { createHash } from 'node:crypto';
import { appResource, checklistCard, nextTaskCard, opportunitiesCard, prdCard, progressNote, projectPage, readAppResource, supervisorPage, verificationCard, withAppMeta } from '@/lib/mcp/apps';
import type { MemoryEntry, ProjectMemory } from '@/lib/db/project-memory';
import { completedVerificationTests, type VerificationRecord, type VerificationVerdict } from '@/lib/db/verifications';
import { AGENT_FEATURE_STATUSES, normalizeFeatureId } from '@/lib/opportunities/build-progress';
import type { AgentFeatureStatus, BuildProgress } from '@/lib/opportunities/build-progress';
import { touchedDoneFeatures, type CommitFileStatus } from '@/lib/opportunities/feature-commits';
import { specInputFor } from '@/lib/opportunities/context';
import { DEFAULT_PAID_PRD_MODEL, DEFAULT_PRD_REASONING, PAID_PRD_MODELS, pickPaidPrdModel, pickReasoning, PRD_REASONING_LEVELS, type PaidPrdOptions } from '@/lib/opportunities/models';
import { PRD_MAX_EVIDENCE } from '@/lib/opportunities/prd-cache';
import { parsePrdMarkdown } from '@/lib/opportunities/prd-markdown';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { briefVersionInstructions, EXPORT_FILES, normalizeSpec, OPEN_SLOT_MARKER, p0FeatureIds, renderAgentBrief, renderSpecMarkdown, SLOT_KEYS, SLOT_LABELS_EN, withPrdReadiness } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecFeature, SpecInput, SpecRival } from '@/lib/opportunities/spec';
import { publicEvidence } from '@/lib/opportunities/types';
import type { Evidence, Opportunity } from '@/lib/opportunities/types';
import { isGitHubLogin } from '@/lib/seeds/github';
import { parseDiff, scrubSecrets } from '@/lib/supervisor/diff-audit';
import { driftCommitFromDiff, findDrift } from '@/lib/supervisor/drift';
import { featureContribution, goalSummary } from '@/lib/supervisor/goal';
import { hookBundle, type BundleFile } from '@/lib/supervisor/hook-bundle';
import { humanTasks } from '@/lib/supervisor/human-queue';
import type { Decision, DriftFinding, ProjectGoal, ProjectKey, SupervisorProject, VerificationLevel } from '@/lib/supervisor/types';
import { validateGitHubCommit } from '@/lib/verifier/github';
import type { StartVerificationInput, VerificationCriterion } from '@/lib/verifier/run';

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
  /** False for a draft validate_idea saved: quotes only, no PRD yet. */
  hasPrd?: boolean;
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
  /** Fills one feature's readiness slots and keeps them: in the shared cache, or in the saved PRD for a prd:<id> key. */
  fillSlots?: (cached: { input: SpecInput; spec: Spec }, featureId: string, key: ProjectKey) => Promise<{ input: SpecInput; spec: Spec } | null>;
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
  generate: (input: SpecInput, draft: boolean, options: PaidPrdOptions) => Promise<Spec | null>;
  consume: (feature: string, dailyLimit: number) => Promise<boolean>;
  /** Refunds one metered use when the downstream model call fails or returns nothing usable. */
  release?: (feature: string) => Promise<void>;
  related: (idea: string) => Promise<Array<{ title: string; url: string | null; source: string; similarity: number }>>;
  progress: (slug: string) => Promise<BuildProgress>;
  linkCommit(slug: string, link: { sha: string; message: string; files: string[]; featureIds: string[]; fileStatuses?: Record<string, CommitFileStatus> }): Promise<void>;
  featureFiles(slug: string, beforeSha?: string): Promise<Record<string, string[]>>;
  flagRecheck(slug: string, featureId: string, sha: string, note: string): Promise<boolean>;
  unlinkedCommitCount(slug: string): Promise<number>;
  startVerification?: (input: Omit<StartVerificationInput, 'userId'>) => Promise<VerificationRecord>;
  fetchCommitDiff?: (repo: string, sha: string) => Promise<string | null>;
  matchesVerificationToken?: (token: string, projectKey: ProjectKey, featureId: string, sha: string) => boolean;
  /** Returns true when the feature enters blocked, so retries of the same status do not notify again. */
  setProgress: (slug: string, feature: { id: string; title: string; verificationLevel?: VerificationLevel }, status: AgentFeatureStatus, note: string, verificationLevel?: VerificationLevel) => Promise<boolean>;
  notifyBlocked: (opportunity: Opportunity, feature: { id: string; title: string }) => Promise<void>;
  /** What this user kept on the site (repos, articles, papers, products), newest first. */
  kept: (type: KeptType | null, limit: number) => Promise<KeptItem[]>;
  /**
   * A validation report for one idea, as Markdown, and the project key (prd:<id>) its quotes were saved under as the
   * user's PRD draft; null when the report could not be made.
   */
  validate: (idea: string) => Promise<{ text: string; projectKey?: string | null } | null>;
  /** Makes and saves the PRD for a draft that validate_idea saved; null when no such draft exists, throws when the model fails. */
  draftPrd?: (id: string, options: PaidPrdOptions) => Promise<SavedPrdDetail | null>;
  /** Starts a weekly watch on one idea; false when the person already watches the most allowed. */
  watch: (idea: string) => Promise<boolean>;
};

export const KEPT_TYPES = ['github', 'news', 'paper', 'ai_product', 'project'] as const;
export type KeptType = (typeof KEPT_TYPES)[number];
export type KeptItem = { type: string; title: string; note: string | null; url: string; page: string; savedAt: string; extra?: string };

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean; structuredContent?: Record<string, unknown> };

const text = (value: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: value }], ...(isError ? { isError } : {}) });

const keyDescription = 'Public opportunity slug or prd:<id> from get_my_prd';
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

const FULL_SHA = /^[a-fA-F0-9]{40}$/;
const developmentModels = { codex: 'openai/gpt', 'claude-code': 'anthropic/claude' } as const;
const shaProperty = { type: 'string', pattern: FULL_SHA.source, description: 'Full 40-character GitHub commit SHA' };

const progressProperties = {
  note: { type: 'string', description: 'One line on what changed or what is blocking work' },
  sha: shaProperty,
  verification_token: { type: 'string', description: 'Server verification proof for this feature and SHA, from verify_feature' },
  checks: {
    type: 'array',
    description: 'For self-reported done, one passing check with evidence per numbered criterion from get_next_task or resume_project.',
    items: {
      type: 'object',
      properties: {
        criterion: { type: 'number', description: 'The criterion number from get_next_task or resume_project' },
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
const CLAUDE_POINTER = 'Read and follow @AGENTS.md before making changes.\n';
const briefArgument = { type: 'string', maxLength: 240, description: 'Optional: the full Seedup brief version line from AGENTS.md or CLAUDE.md.' };

const prdModelSchema = {
  model: { type: 'string', enum: PAID_PRD_MODELS, default: DEFAULT_PAID_PRD_MODEL, description: 'Model for new PRD generation. Default GPT 6.2 Sol.' },
  reasoning: { type: 'string', enum: PRD_REASONING_LEVELS, default: DEFAULT_PRD_REASONING, description: 'Reasoning effort for new PRD generation. Default high.' },
};

function prdOptions(args: Record<string, unknown>): PaidPrdOptions {
  return { model: pickPaidPrdModel(args.model), reasoning: pickReasoning(args.reasoning) };
}

export const TOOLS = [
  {
    name: 'resume_project',
    description: '[개발] Resume a project with its locked goal, connected repository, full build checklist (F-n status, done criteria, unlinked commits), recent decisions, and last handoff.',
    inputSchema: projectSchema({
      has_setup_files: { type: 'boolean', description: 'Optional: whether AGENTS.md, CLAUDE.md, and .seedup/ are already present in the local repository' },
      brief: briefArgument,
    }),
    annotations: READ_ONLY,
  },
  {
    name: 'setup_project',
    description: '[개발] Return the repository files to write for a project: AGENTS.md (with locked goal and project key), CLAUDE.md (pointing to AGENTS.md), and local hook bundle files (pre-commit and Claude Code / Codex hooks when a goal is locked). Never includes tokens.',
    inputSchema: projectSchema(),
    annotations: READ_ONLY,
  },
  {
    name: 'get_next_task',
    description: '[개발] Call at the start of a session. Returns the locked goal, recent memory, and one ready feature ranked by contribution to the goal, with done criteria and evidence.',
    inputSchema: projectSchema({ brief: briefArgument }),
    annotations: READ_ONLY,
  },
  {
    name: 'update_feature_status',
    description: '[개발] Report a feature status. For done, use the SHA and verification token from verify_feature. A non-strict project also accepts self-reported passing checks.',
    inputSchema: projectSchema({
      ...progressProperties,
      feature_id: { type: 'string', description: 'Feature id, e.g. F-01' },
      status: { type: 'string', enum: AGENT_FEATURE_STATUSES },
    }, ['feature_id', 'status']),
    annotations: STATE_WRITE,
  },
  {
    name: 'verify_feature',
    description: '[개발] Verify a feature against its stored PRD criteria using the connected public GitHub repository, the full commit SHA, and CI, and auto-link the commit. Re-call with the same feature and SHA to read an existing or running result.',
    inputSchema: projectSchema({
      feature: { type: 'string' },
      sha: shaProperty,
      developed_with: { type: 'string', enum: Object.keys(developmentModels), description: 'Development tool, if known, so the verifier uses a different model family' },
    }, ['feature', 'sha']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'link_commit',
    description: '[개발] Record a commit and its changed file paths (with optional added, modified, or deleted status) for a PRD. Use only when the user has enabled commit uploads for this project. Features default to the F-n ids in the commit message.',
    inputSchema: projectSchema({
      sha: { type: 'string', pattern: '^[a-fA-F0-9]{7,40}$' },
      message: { type: 'string', maxLength: 500 },
      files: {
        type: 'array',
        maxItems: 200,
        items: {
          oneOf: [
            { type: 'string', maxLength: 300, description: 'Repository-relative path' },
            {
              type: 'object',
              properties: {
                path: { type: 'string', maxLength: 300, description: 'Repository-relative path' },
                status: { type: 'string', enum: ['added', 'modified', 'deleted'] },
              },
              required: ['path', 'status'],
            },
          ],
        },
      },
      file_statuses: {
        type: 'object',
        additionalProperties: { type: 'string', enum: ['added', 'modified', 'deleted'] },
        description: 'Optional map of repository-relative file path to status (added | modified | deleted)',
      },
      features: { type: 'array', items: { type: 'string' }, description: 'Override feature ids from the commit message' },
    }, ['sha', 'message', 'files']),
    annotations: STATE_WRITE,
  },
  {
    name: 'explain_file',
    description: '[개발] Reverse-trace a repository file path back to the PRD features (F-n), requirements (R-n/H-n), verified user quotes (E-n), and done criteria that depend on it.',
    inputSchema: projectSchema({ path: { type: 'string', description: 'Repository-relative file path, e.g. src/notes.ts' } }, ['path']),
    annotations: READ_ONLY,
  },
  {
    name: 'connect_repo',
    description: '[개발] Connect a public GitHub repository (owner/repo) to the project using Seedup’s server credentials.',
    inputSchema: projectSchema({ repo: { type: 'string', description: 'Public GitHub owner/repo' } }, ['repo']),
    annotations: { ...STATE_WRITE, openWorldHint: true },
  },
  {
    name: 'check_env',
    description: '[개발] Compare key names found by the agent in the local environment with the project’s expected names. Send names only, never values or file contents.',
    inputSchema: projectSchema({ names: { type: 'array', maxItems: 100, items: { type: 'string', pattern: ENV_NAME.source } } }, ['names']),
    annotations: READ_ONLY,
  },
  {
    name: 'record_decision',
    description: '[개발] Record a decision and why. Set scope_change=true for changes to the goal, success criteria or scope. Ask the user in the terminal before acting, then record their answer. Never include secrets.',
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
    description: '[개발] Save a short handoff with the current and next task, cautions and unverified commit SHAs. Never include secrets.',
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
    description: '[개발] Read the full entries for project decisions, handoffs and facts, newest first (limit per kind).',
    inputSchema: projectSchema({ limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 50 per kind' } }),
    annotations: READ_ONLY,
  },
  {
    name: 'search_opportunities',
    description: '[기획] Search Seedup build opportunities: developer pains with verified quotes from GitHub, Hacker News and Stack Overflow, and how crowded the market is.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords, e.g. "agent memory" or "schema"' }, limit: { type: 'number', minimum: 1, maximum: 10 } }, required: ['query'] },
    annotations: READ_ONLY,
  },
  {
    name: 'get_opportunity',
    description: '[기획] Full detail of one opportunity: the problem, the gap, every verified quote with its source link, and direct competitors.',
    inputSchema: projectSchema(),
    annotations: READ_ONLY,
  },
  {
    name: 'generate_verified_prd',
    description: '[기획] An evidence-traced PRD for one opportunity (evidence → requirements → features → screens) as AGENTS.md, CLAUDE.md, a Cursor rule (.cursor/rules/seedup.mdc), a paste-in prompt for app builders (Lovable, Bolt, v0) or PRD markdown. Every requirement cites a verified quote; below the evidence bar it is labeled a hypothesis draft. With a prd:<id> key from validate_idea it makes and saves that idea\'s PRD the first time.',
    inputSchema: projectSchema({
      ...prdModelSchema,
      format: { type: 'string', enum: ['agents', 'claude', 'cursor', 'prompt', 'prd'], description: 'Default agents (AGENTS.md)' },
      fresh: { type: 'boolean', description: 'Generate again for a public opportunity to apply model or reasoning to an existing PRD' },
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'get_my_prd',
    description: '[기획] List PRDs saved by this user (when id is omitted) or read one saved PRD by id as PRD markdown or an agent brief (AGENTS.md, CLAUDE.md, Cursor rule, or app-builder prompt).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional saved PRD id (UUID); omit to list all saved PRDs' },
        format: { type: 'string', enum: ['prd', 'agents', 'claude', 'cursor', 'prompt'], description: 'Used when id is given. Default prd' },
        limit: { type: 'number', minimum: 1, maximum: 50, description: 'Used when listing without id. Default 20' },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: 'validate_idea',
    description: '[기획] Should I build this? A report for one idea: real quotes from GitHub issues, Hacker News and Stack Overflow (kept only when they match the source word for word), the tools that already solve it, how big a first version is for one person, where the first users are, and a verdict on the 3-quotes-from-2-sites bar. Searches everyday Q&A sites too when the idea is not for developers, and tries other words when the first ones find too little. The quotes are saved as your project (prd:<id>); call generate_verified_prd with that key to make its PRD. Model and reasoning apply to that next PRD call. Takes about a minute; 3 a day.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string', description: 'The idea in one sentence, any language' }, ...prdModelSchema }, required: ['idea'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'watch_idea',
    description: '[기획] Watch one idea: once a week Seedup searches again and mails the user any new quotes or new rival tools for it. Up to 10 ideas.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
    annotations: STATE_WRITE,
  },
  {
    name: 'get_kept_items',
    description: '[기획] What the user kept on Seedup to use later: GitHub repositories, articles, papers and products, with their links, newest first. Read them as references before planning or building, e.g. a repo to reuse or an article the user wants applied.',
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
    description: '[기획] News, papers, repos and products Seedup collected that are semantically close to an idea, for grounding an evaluation.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
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
const toolCall = (name: string, args: Record<string, unknown>) => `${name} ${JSON.stringify(args)}`;

function shortGoal(goal: ProjectGoal | null | undefined) {
  if (!goal) return '';
  const lines = goalSummary({
    ...goal,
    statement: oneLine(scrubSecrets(goal.statement).scrubbed, 180),
    criteria: goal.criteria.map((row) => ({
      ...row, text: oneLine(scrubSecrets(row.text).scrubbed, 70), measure: oneLine(scrubSecrets(row.measure).scrubbed, 60),
    })),
    outOfScope: goal.outOfScope.map((item) => oneLine(scrubSecrets(item).scrubbed, 80)),
  }, 'en').split('\n');
  return [...lines.slice(0, 3), oneLine(lines.slice(3).join(' · '), 280)].filter(Boolean).join('\n');
}

function projectReply(outcome: string, goal: ProjectGoal | null | undefined, body: string, next: string, isError = false) {
  return text([outcome, shortGoal(goal), body, `Next: ${next}`].filter(Boolean).join('\n'), isError);
}

function scopeDecision(project: ProjectKey, feature?: string) {
  return toolCall('record_decision', {
    project, title: '<decision>', why: '<user’s reason>', agent: '<your name>', scope_change: true,
    ...(feature ? { feature_ids: [feature] } : {}), approval: '<대화에서 승인 | 대화에서 거절>',
  });
}

const prdLanguage = (spec?: Spec) => spec?.lang ?? (/[가-힣]/.test(spec?.summary ?? '') ? 'ko' : 'en');

function briefVersion(key: ProjectKey, spec: Spec, goal: ProjectGoal | null | undefined) {
  // Keep typo corrections and readiness-slot fills from invalidating the repository files.
  const links = [
    spec.features.map((feature) => [feature.id, [...feature.requirementIds].sort()]),
    spec.screens.map((screen) => [screen.id, [...screen.featureIds].sort()]),
  ];
  const digest = createHash('sha256').update(JSON.stringify(links)).digest('hex').slice(0, 16);
  return `<!-- Seedup brief: project=${key} goal=${goal?.version ?? 'none'} prd=${digest} -->`;
}

function staleBrief(value: unknown, key: ProjectKey, spec: Spec | undefined, goal: ProjectGoal | null | undefined) {
  if (typeof value !== 'string' || !value.trim() || !spec || goal === undefined || value.trim() === briefVersion(key, spec, goal)) return null;
  return projectReply('AGENTS.md is out of date. Refresh the setup files.', goal,
    prdLanguage(spec) === 'ko' ? '> AGENTS.md가 예전 버전입니다. setup_project로 다시 받으세요.' : '', toolCall('setup_project', { project: key }));
}

function askScope(lang: Spec['lang'], project: ProjectKey, feature?: string) {
  const question = lang === 'ko' ? '잠긴 목표나 범위를 조정할까요?' : 'Should we change the locked goal or scope?';
  const options = lang === 'ko' ? '변경 승인 / 기존 범위 유지' : 'Approve the change / Keep the current scope';
  return `ASK USER (in the terminal, before acting):\n> ${question}\nOptions: ${options}\nAfter the answer: ${scopeDecision(project, feature)}`;
}

function recentDecisions(memory: ProjectMemory | undefined) {
  return (memory?.decisions ?? []).slice(0, 3).map((decision) =>
    oneLine(decision.title) + (decision.approved === true ? ` (${APPROVED})` : decision.approved === false ? ` (${REJECTED})` : ''));
}

async function projectContext(deps: McpDeps, key: ProjectKey) {
  // Legacy tools still work while the supervisor migration is being rolled out.
  const [goal, memory] = await Promise.all([
    deps.projectGoal?.(key).catch(() => undefined),
    deps.projectMemory?.(key, 3).catch(() => undefined),
  ]);
  return { goal, memory };
}

/** The goal and memory lines resume_project and get_next_task hand the agent (memory read with a limit of 3). */
export function contextText(goal: ProjectGoal | null | undefined, memory: ProjectMemory | undefined) {
  const decisions = recentDecisions(memory);
  const handoff = memory?.handoffs[0];
  return [
    goal && goalSummary(goal, 'en'),
    decisions.length && `Recent decisions\n${decisions.map((decision) => `- ${decision}`).join('\n')}`,
    handoff && `Last handoff (${oneLine(handoff.agent, 80)})\nCurrent: ${oneLine(handoff.doing)}\nNext task: ${oneLine(handoff.next)}${handoff.cautions.length ? `\nCautions: ${oneLine(handoff.cautions.join('; '))}` : ''}${handoff.unverifiedShas.length ? `\nUnverified commits: ${oneLine(handoff.unverifiedShas.join(', '))}` : ''}`,
  ].filter(Boolean).join('\n\n');
}

async function nextTaskResult(opportunity: Opportunity, found: { input: SpecInput; spec: Spec } | null, deps: McpDeps, brief: unknown): Promise<ToolResult> {
  const { slug } = opportunity;
  const [{ goal, memory }, savedProgress] = await Promise.all([projectContext(deps, slug), found ? deps.progress(slug) : undefined]);
  const warning = staleBrief(brief, slug, found?.spec, goal);
  if (warning) return warning;
  const context = contextText(null, memory);
  const checklist = toolCall('resume_project', { project: slug });
  if (!found) return projectReply(slug.startsWith('prd:')
    ? 'This saved PRD has no readable feature spec. Update it in Seedup.'
    : `No PRD for "${slug}" yet. Call generate_verified_prd first.`, goal, context, toolCall('generate_verified_prd', { project: slug }), true);
  const progress: BuildProgress = savedProgress ?? {};
  let cached = found;
  const task = pickNextTask(cached.spec, progress, goal);
  if (!task.feature) return projectReply(`No next task for "${slug}". ${task.why}`, goal, context, checklist);

  const { status, evidence, why } = task;
  let feature = task.feature;
  // The feature about to be built gets its readiness slots now if the PRD never had them, once; the PRD keeps them.
  if (!feature.slots && deps.fillSlots) {
    const filled = await deps.fillSlots(cached, feature.id, slug).catch(() => null);
    const updated = filled?.spec.features.find((row) => row.id === feature.id);
    if (filled && updated?.slots) {
      cached = filled;
      feature = updated;
    }
  }
  // A P0 feature not started yet with open readiness questions is not built on a guess: the agent gets the questions
  // to ask the user, and the coding task opens once an answer approved in the conversation is recorded for it.
  const questions = status === 'todo' && p0FeatureIds(cached.spec).has(feature.id) ? openQuestionsOf(feature) : [];
  if (questions.length && !(await answeredFeature(deps, slug, feature.id))) return questionsFirst(slug, goal, context, feature, questions);
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
  const note = progressNote(progress[feature.id]?.note ?? '');
  const setup = peopleFirst(cached.spec, feature.id);
  const outcome = `${feature.id} ${oneLine(progressNote(feature.title))} [${status}]`;
  return {
    ...projectReply(outcome, goal, `${setup}${context ? `${context}\n\n` : ''}${feature.detail}
${why}${task.scopeCheck ? `\n${askScope(prdLanguage(cached.spec), slug, feature.id)}` : ''}${note ? `\nPrevious status note: ${note}` : ''}

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

After pushing the commit, verify the feature with its full GitHub SHA and use the returned proof to report done.
${verifyNext(slug, feature.id, undefined)}

For self-reporting in a non-strict project, provide one passing check per criterion
update_feature_status ${JSON.stringify({ ...args, status: 'done', checks })}

If blocked, describe what is blocking work
update_feature_status ${JSON.stringify({ ...args, status: 'blocked', note: '<what is blocking work>' })}`,
    task.scopeCheck ? scopeDecision(slug, feature.id) : toolCall('update_feature_status', { ...args, status: 'in_progress' })),
    structuredContent: nextTaskCard(feature, why, criteria.length, quotes.length, files, shortGoal(goal) || undefined),
  };
}

/** The readiness slots of a feature still left open, as questions for the user. */
export function openQuestionsOf(feature: SpecFeature) {
  return SLOT_KEYS.flatMap((key) => {
    const items = feature.slots?.[key] ?? [];
    if (!items.length) return [`${SLOT_LABELS_EN[key]}: what should it be?`];
    return items.filter((line) => OPEN_SLOT_MARKER.test(line.trim())).map((line) => `${SLOT_LABELS_EN[key]}: ${line.trim().replace(OPEN_SLOT_MARKER, '').trim()}`);
  }).slice(0, 6);
}

/** True once a decision the user approved in the conversation names this feature. */
async function answeredFeature(deps: McpDeps, key: ProjectKey, featureId: string) {
  const memory = await deps.projectMemory?.(key, 50).catch(() => undefined);
  return Boolean(memory?.decisions.some((decision) => decision.approved === true && decision.featureIds.includes(featureId)));
}

function questionsFirst(key: ProjectKey, goal: ProjectGoal | null | undefined, context: string, feature: SpecFeature, questions: string[]): ToolResult {
  const record = { project: key, title: '<the answer>', why: '<the user’s reason>', agent: '<your name>', scope_change: false, feature_ids: [feature.id], approval: APPROVED };
  return projectReply(`${feature.id} ${oneLine(feature.title)} [open questions]`, goal, `${context ? `${context}\n\n` : ''}${feature.detail}

The answers change how ${feature.id} is built, so do not guess. Ask the user in the terminal, one question at a time:
${questions.map((line, index) => `${index + 1}. ${line}`).join('\n')}

A suggested default, or leaving the case out of the first version, is a valid answer. Record the answers for this feature, then call get_next_task again:
record_decision ${JSON.stringify(record)}`, toolCall('record_decision', record));
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

/**
 * Done features split by who confirmed them: 🟢 the supervisor checked the commit, ⚪ the agent's own report. A goal
 * count or benchmark that reads this must not treat ⚪ as checked.
 */
export function doneSummary(spec: Spec, progress: BuildProgress) {
  const done = spec.features.filter((feature) => progress[feature.id]?.status === 'done');
  const verified = done.filter((feature) => progress[feature.id]?.verificationLevel === 'supervisor_verified').length;
  return `${done.length}/${spec.features.length} done (🟢 ${verified} supervisor verified, ⚪ ${done.length - verified} self-reported)`;
}

export function renderChecklist(opportunity: Opportunity, spec: Spec, progress: BuildProgress, siteUrl: string, unlinkedCount?: number, tests: Record<string, string[]> = {}) {
  const lines = spec.features.map((feature) => {
    const mark = progress[feature.id];
    const status = mark?.status ?? 'todo';
    const criteria = featureCriteria(spec, feature).map((line, index) => `    ${index + 1}. ${line}`).join('\n');
    const level = status === 'done' ? (mark?.verificationLevel === 'supervisor_verified' ? ' 🟢' : ' ⚪') : '';
    return `- [${status === 'done' ? 'x' : ' '}] ${feature.id} ${feature.title} [${status}]${level} (serves ${feature.requirementIds.join(', ') || '-'})
    ${feature.detail}
  Done when:
${criteria}${tests[feature.id]?.length ? `\n  ${tests[feature.id].join('\n  ')}` : ''}${mark?.note ? `\n  Note: ${progressNote(mark.note)}` : ''}`;
  });
  return `Build checklist for ${opportunity.name} (${opportunity.slug}): ${doneSummary(spec, progress)}${spec.draft ? ', hypothesis draft' : ''}${unlinkedCount === undefined ? '' : `\nUnlinked commits: ${unlinkedCount}.`}
Work on one feature at a time. Call update_feature_status when starting and ending. For verified completion, use the full SHA and token from verify_feature. In a non-strict project, one passing check per criterion is accepted as a self-report.
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
    item.hasPrd === false
      ? `  Draft from validate_idea, no PRD yet. Make it: generate_verified_prd {"project":"prd:${item.id}"}`
      : `  Use: get_my_prd {"id":"${item.id}","format":"agents"}`,
  ].join('\n')).join('\n\n')}`;
}

function savedProject(saved: SavedPrdDetail, key: ProjectKey) {
  const parsed = parsePrdMarkdown(saved.prdMarkdown);
  const rivals = (parsed?.rivals ?? []) as SpecRival[];
  const publicQuotes = publicEvidence(saved.evidence);
  const platforms = [...new Set(publicQuotes.map((row) => row.platform))];
  const qualified = meetsEvidenceBar(publicQuotes.length, platforms.length);
  const spec = parsed && {
    // A personal PRD can inherit a public opportunity slug from its evidence without losing its hypothesis features.
    ...normalizeSpec(parsed, saved.evidence, !qualified, { idea: key.startsWith('prd:'), competitorNotes: saved.competitorNotes }),
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
  const { goal, memory } = format === 'agents' ? await projectContext(deps, key)
    : format === 'claude' ? { goal: await deps.projectGoal?.(key).catch(() => null) } : {};
  const version = format === 'agents' || format === 'claude' ? briefVersion(key, spec, goal) : undefined;
  return `Save as ${EXPORT_FILES[format]}:\n\n${renderAgentBrief(input, spec, format, key, { goal, decisions: recentDecisions(memory), briefVersion: version })}`;
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
  'get_next_task',
  'update_feature_status',
  'link_commit',
  'verify_feature',
  'explain_file',
]);

const SUPERVISOR_TOOLS = new Set(['resume_project', 'setup_project', 'connect_repo', 'check_env', 'record_decision', 'save_handoff', 'get_project_memory']);

/** The project page, plus the planning page when it is a different one (public opportunities). */
const webPages = (siteUrl: string, key: string) => {
  const project = supervisorPage(siteUrl, key);
  const planning = projectPage(siteUrl, key);
  return planning === project ? project : `${project} (planning: ${planning})`;
};

const webLine = (siteUrl: string, key: string) =>
  `On the web (goal, features, verifications; in the Claude desktop app, open it in the browser pane): ${supervisorPage(siteUrl, key)}`;

/**
 * Every successful project tool call on a personal PRD ends with its web page, so what the agent did can be seen there.
 * Public opportunity keys are left out: their project page exists only once the user starts tracking one.
 */
export function withWebLink(result: ToolResult, name: string, args: Record<string, unknown>, siteUrl: string): ToolResult {
  const key = projectKey(args);
  if (result.isError || !key?.startsWith('prd:') || (!OPPORTUNITY_TOOLS.has(name) && !SUPERVISOR_TOOLS.has(name))) return result;
  return { ...result, content: [...result.content, { type: 'text', text: webLine(siteUrl, key) }] };
}

const verifyNext = (project: ProjectKey, feature: string, sha: string | undefined) =>
  toolCall('verify_feature', { project, feature, sha: sha ?? '<full GitHub SHA>' });

const COMMIT_FILE_STATUSES = new Set<CommitFileStatus>(['added', 'modified', 'deleted']);
const MAX_DRIFT_DIFF = 2_000_000;

function parseCommitFiles(
  rawFiles: unknown,
  rawStatuses: unknown,
): { files: string[]; fileStatuses: Record<string, CommitFileStatus> } | null {
  if (!Array.isArray(rawFiles) || rawFiles.length > 200) return null;
  const files: string[] = [];
  const fileStatuses: Record<string, CommitFileStatus> = {};
  for (const entry of rawFiles) {
    if (isRepoPath(entry)) {
      files.push(entry);
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      if (!isRepoPath(record.path)) return null;
      if (typeof record.status !== 'string' || !COMMIT_FILE_STATUSES.has(record.status as CommitFileStatus)) return null;
      files.push(record.path);
      fileStatuses[record.path] = record.status as CommitFileStatus;
    } else {
      return null;
    }
  }
  if (rawStatuses !== undefined) {
    if (!rawStatuses || typeof rawStatuses !== 'object' || Array.isArray(rawStatuses)) return null;
    const entries = Object.entries(rawStatuses as Record<string, unknown>);
    if (entries.length > 200) return null;
    for (const [path, status] of entries) {
      if (!isRepoPath(path) || typeof status !== 'string' || !COMMIT_FILE_STATUSES.has(status as CommitFileStatus)) return null;
      fileStatuses[path] = status as CommitFileStatus;
      if (!files.includes(path)) files.push(path);
    }
    if (files.length > 200) return null;
  }
  return { files, fileStatuses };
}

async function fetchVerificationDiff(repo: string, sha: string, override?: McpDeps['fetchCommitDiff']): Promise<string | null> {
  if (override) return override(repo, sha);
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;
  validateGitHubCommit(repo, sha);
  const response = await fetch(`https://api.github.com/repos/${repo}/commits/${sha.toLowerCase()}`, {
    // GitHub answers 403 to a request without a User-Agent; Node adds one by itself, Workers do not.
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.diff', 'X-GitHub-Api-Version': '2022-11-28', 'user-agent': 'seedup' },
    // Workers reject 'error' outright; 'manual' leaves a 3xx unfollowed and the ok check below refuses it.
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  if (Number(response.headers.get('content-length')) > MAX_DRIFT_DIFF) {
    await response.body?.cancel();
    return null;
  }
  const diff = await response.text();
  return Buffer.byteLength(diff) <= MAX_DRIFT_DIFF ? diff : null;
}

function mergeDriftFindings(existing: DriftFinding[], incoming: DriftFinding[]): DriftFinding[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((item) => `${item.kind}:${[...item.files].sort().join(',')}`));
  const added = incoming.filter((item) => {
    const key = `${item.kind}:${[...item.files].sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return added.length ? [...existing, ...added] : existing;
}

function verificationTestLines(verdicts: VerificationVerdict[], criteria?: string[]) {
  const listed = verdicts.flatMap(({ criterion, testEvidence }) => {
    if (!testEvidence) return [];
    if (criteria && (!testEvidence.files.length || testEvidence.criterionText !== scrubSecrets(criteria[Number(criterion) - 1] ?? '').scrubbed)) return [];
    return [{ criterion, ...testEvidence }];
  });
  const limited = (items: string[]) => items.slice(0, 2).map((item) => oneLine(progressNote(item), 100)).join(', ')
    + (items.length > 2 ? ` (+${items.length - 2})` : '');
  return [
    ...listed.slice(0, 3).map(({ criterion, files, checks }) =>
      `Tests for criterion ${oneLine(criterion, 12)}: ${files.length ? limited(files) : 'no verified test citation'}${checks.length ? ` · CI: ${limited(checks)}` : ''}`),
    ...(listed.length > 3 ? [`Test evidence for ${listed.length - 3} more criteria.`] : []),
  ];
}

function verificationResult(row: VerificationRecord, goal: ProjectGoal | null | undefined, lang?: Spec['lang']): ToolResult {
  const project = row.projectKey;
  const pending = row.status === 'queued' || row.status === 'running';
  const proof = row.status === 'passed' ? row.token : null;
  const outcome = `${row.featureId} @ ${row.sha.slice(0, 8)}: ${proof ? '🟢 supervisor verified' : `Verification ${row.status}`}.`;
  const verdicts = row.verdicts.map((item) => ({
    criterion: item.criterion,
    verdict: item.verdict,
    citations: item.citations.filter((citation) => citation.verified).length,
  }));
  const blockers = row.findings.filter((finding) => finding.severity === 'blocker').map((finding) => finding.code);
  const warnings = row.findings.length - blockers.length;
  const tests = verificationTestLines(row.verdicts);
  const scopeWarning = row.drift.length > 0;
  const driftItems = [...new Set(row.drift.flatMap((finding) => finding.files))].slice(0, 6);
  const groupedVerdicts = (['met', 'not_met', 'unclear'] as const).flatMap((verdict) => {
    const ids = verdicts.filter((item) => item.verdict === verdict).map((item) => item.criterion);
    return ids.length ? [`${verdict.replace('_', ' ')}: ${ids.join(', ')}`] : [];
  });
  const body = [
    pending && `Verification ID: ${row.id}`,
    groupedVerdicts.length && `Criterion verdicts — ${groupedVerdicts.join(' · ')}.`,
    tests.join('\n'),
    blockers.length && `Blockers: ${blockers.length} (${[...new Set(blockers)].slice(0, 5).join(', ')}).`,
    warnings > 0 && `Static warnings: ${warnings}.`,
    row.unseen.length > 0 && `Files the verifier could not read: ${row.unseen.length}.`,
    scopeWarning && `Scope warnings: ${row.drift.length}${driftItems.length ? ` (${driftItems.join(', ')})` : ''}. Review the changes with the user.\n${askScope(lang, project, row.featureId)}`,
    scopeWarning && proof && `Verification proof for after the scope review: ${proof}`,
    row.status === 'error' && 'The verification did not complete. Check the connected repository, GitHub access and the verification quota.',
  ].filter(Boolean).join('\n');
  const next = pending ? toolCall('verify_feature', { project, feature: row.featureId, sha: row.sha })
    : scopeWarning ? scopeDecision(project, row.featureId)
    : proof ? toolCall('update_feature_status', { project, feature_id: row.featureId, status: 'done', sha: row.sha, verification_token: proof })
    : toolCall('resume_project', { project });
  return {
    ...projectReply(outcome, goal, body, next, row.status === 'error'),
    structuredContent: verificationCard(row, shortGoal(goal), verdicts, blockers.length, warnings, tests),
  };
}

async function startFeatureVerification(args: Record<string, unknown>, key: ProjectKey, spec: Spec, deps: McpDeps) {
  const [project, goal] = await Promise.all([deps.supervisorProject?.(key), deps.projectGoal?.(key)]);
  const id = typeof args.feature === 'string' ? normalizeFeatureId(args.feature) : null;
  const feature = spec.features.find((row) => row.id === id);
  if (!feature) return projectReply('Unknown feature.', goal, '', toolCall('resume_project', { project: key }), true);
  const sha = typeof args.sha === 'string' && FULL_SHA.test(args.sha) ? args.sha.toLowerCase() : undefined;
  const retry = verifyNext(key, feature.id, sha);
  if (!project?.repo) return projectReply('A public GitHub repository is required for server verification.', goal, '', toolCall('connect_repo', { project: key, repo: '<owner/repo>' }), true);
  if (!sha || Object.hasOwn(args, 'diff')) {
    return projectReply('Verification requires a full 40-character GitHub SHA without a diff argument.', goal, '', retry, true);
  }
  const tool = args.developed_with;
  const developmentModel = tool === 'codex' || tool === 'claude-code' ? developmentModels[tool] : undefined;
  if (tool !== undefined && !developmentModel) {
    return projectReply('Unknown development tool. Use codex or claude-code when known.', goal, '', retry, true);
  }
  const criteria: VerificationCriterion[] = featureCriteria(spec, feature).map((criterion, index) => ({
    id: String(index + 1),
    text: criterion,
    kind: /테스트|\b(?:tests?|CI|jest|vitest|pytest|playwright)\b/i.test(criterion) ? 'test' : 'code',
  }));
  if (criteria.length > 40) return projectReply('A verification can check at most 40 criteria per feature.', goal, 'Split this feature in the PRD before verifying it.', toolCall('resume_project', { project: key }), true);
  try {
    if (deps.startVerification) {
      const row = await deps.startVerification({
        projectKey: key, featureId: feature.id, repo: project.repo, sha, criteria,
        ...(goal ? { outOfScope: goal.outOfScope } : {}),
        ...(developmentModel ? { developmentModel } : {}),
      });
      const attachedDiff = (row as VerificationRecord & { diff?: unknown }).diff;
      const diff = typeof attachedDiff === 'string'
        ? attachedDiff
        : row.status !== 'error'
          ? await fetchVerificationDiff(project.repo, sha, deps.fetchCommitDiff).catch(() => null)
          : null;
      const diffCommit = diff ? driftCommitFromDiff({ sha, featureIds: [feature.id], diff }) : null;
      const diffFiles = diffCommit ? diffCommit.files.filter(Boolean) : [];
      // Auto-link verified commits only when changed files were resolved from the diff, so a transient diff fetch failure
      // cannot poison feature_commits with an empty file list (writeFeatureCommit uses ignoreDuplicates).
      if (row.status !== 'error' && diff && diffFiles.length > 0) {
        const fileStatuses: Record<string, CommitFileStatus> = {};
        for (const file of parseDiff(diff)) {
          if (file.path) fileStatuses[file.path] = file.isNew ? 'added' : 'modified';
        }
        const hasStatuses = Object.keys(fileStatuses).length > 0;
        await deps.linkCommit(key, {
          sha,
          message: `verify_feature ${feature.id}`,
          files: diffFiles,
          featureIds: [feature.id],
          ...(hasStatuses ? { fileStatuses } : {}),
        }).catch(() => undefined);
      }
      const diffDrift = diffCommit
        ? findDrift([diffCommit], spec, goal ?? null)
            .filter((finding) => finding.kind === 'out_of_spec')
        : [];
      const mergedRow = diffDrift.length ? { ...row, drift: mergeDriftFindings(row.drift, diffDrift) } : row;
      return verificationResult(mergedRow, goal, prdLanguage(spec));
    }
  } catch {
    // Provider and database errors can include source or credentials.
  }
  return projectReply('Server verification is unavailable.', goal, 'Retry when the service is available.', retry, true);
}

async function updateBuildStatus(args: Record<string, unknown>, opportunity: Opportunity, spec: Spec, deps: McpDeps, siteUrl: string): Promise<ToolResult> {
  const project = opportunity.slug;
  const checklist = toolCall('resume_project', { project });
  const goal = await deps.projectGoal?.(project).catch(() => null);
  const rawStatus = args.status;
  if (rawStatus === 'needs_recheck') return projectReply('Status "needs_recheck" is server-only.', goal, '', checklist, true);
  const status = AGENT_FEATURE_STATUSES.find((value) => value === rawStatus);
  if (!status) return projectReply(`Invalid status. Use one of: ${AGENT_FEATURE_STATUSES.join(', ')}.`, goal, '', checklist, true);
  const id = typeof args.feature_id === 'string' ? normalizeFeatureId(args.feature_id) : null;
  const feature = spec.features.find((row) => row.id === id);
  if (!feature) return projectReply('Unknown feature.', goal, '', checklist, true);
  let note = progressNote(typeof args.note === 'string' ? args.note.slice(0, 2000) : '');
  let completion: { featureId: string; level: 'supervisor_verified' | 'self_reported' } | undefined;
  if (status === 'done') {
    const sha = typeof args.sha === 'string' && FULL_SHA.test(args.sha) ? args.sha.toLowerCase() : undefined;
    const token = typeof args.verification_token === 'string' && args.verification_token.length <= 2000 ? args.verification_token : null;
    const settings = await deps.supervisorProject?.(project);
    const verified = sha && token && deps.matchesVerificationToken?.(token, project, feature.id, sha);
    if (verified) {
      completion = { featureId: feature.id, level: 'supervisor_verified' };
      note = [`[supervisor_verified:${sha}]`, note].filter(Boolean).join(' ');
    } else {
      if (settings?.strict) {
        return projectReply(`${feature.id} is not marked done. Strict mode requires a valid verification token for this feature and SHA.`, goal, '', verifyNext(project, feature.id, sha), true);
      }
      const criteria = featureCriteria(spec, feature);
      const { unmet, passing } = unmetCriteria(criteria, args.checks);
      if (unmet.length) {
        const missing = unmet.slice(0, 5).map(({ n, line }) => `  ${n}. ${oneLine(progressNote(line), 160)}`).join('\n');
        return projectReply(`${feature.id} is not marked done: ${unmet.length} of ${criteria.length} criteria have no passing check.`, goal, missing, checklist, true);
      }
      const proof = passing.map((check) => `${check.criterion}: ${oneLine(progressNote(check.evidence), 160)}`).join('; ');
      completion = { featureId: feature.id, level: 'self_reported' };
      note = '[self_reported] ' + [note, `checks ${passing.length}/${criteria.length} (${proof})`].filter(Boolean).join(' · ');
    }
  }
  const verificationLevel: VerificationLevel = completion?.level ?? 'self_reported';
  const enteredBlocked = await deps.setProgress(project, { id: feature.id, title: feature.title, verificationLevel }, status, note, verificationLevel);
  if (status === 'blocked' && enteredBlocked) await deps.notifyBlocked(opportunity, feature).catch(() => undefined);
  const progress = await deps.progress(project);
  const mark = completion?.level === 'supervisor_verified' ? ' 🟢 supervisor verified' : completion ? ' ⚪ self-reported' : '';
  const title = oneLine(progressNote(feature.title));
  const body = [`${doneSummary(spec, progress)}.`, status === 'done' && `- [x] ${feature.id} ${title}`, oneLine(progressNote(note), 260)].filter(Boolean).join('\n');
  return {
    ...projectReply(`${feature.id} ${title} [${status}]${mark}`, goal, body, toolCall('get_next_task', { project })),
    structuredContent: checklistCard(opportunity, spec, progress, (item) => featureCriteria(spec, item), siteUrl, completion, shortGoal(goal)),
  };
}

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

async function callSupervisorTool(name: string, args: Record<string, unknown>, opportunity: Opportunity, deps: McpDeps, loadSpec: () => Promise<{ input: SpecInput; spec: Spec } | null>, siteUrl: string) {
  const key = opportunity.slug;
  if (name === 'resume_project') {
    const [project, goal, memory, progress, cached] = await Promise.all([
      deps.supervisorProject?.(key), deps.projectGoal?.(key), deps.projectMemory?.(key, 3), deps.progress(key), loadSpec().catch(() => null),
    ]);
    const warning = staleBrief(args.brief, key, cached?.spec, goal);
    if (warning) return warning;
    const commits = Object.fromEntries((cached?.spec.features ?? []).flatMap(({ id }) => {
      const row = progress[id];
      const sha = row?.status === 'done' && row.verificationLevel === 'supervisor_verified'
        ? /^\[supervisor_verified:([a-f0-9]{40})\]/.exec(row.note)?.[1] : undefined;
      return sha ? [[id, sha]] : [];
    }));
    const [unlinkedCount, verified = {}] = await Promise.all([
      cached ? deps.unlinkedCommitCount(key).catch(() => undefined) : undefined,
      project?.repo ? completedVerificationTests(project.userId, key, project.repo, commits).catch(() => undefined) : undefined,
    ]);
    const tests = cached ? Object.fromEntries(cached.spec.features.map((feature) => [
      feature.id, verificationTestLines(verified[feature.id] ?? [], featureCriteria(cached.spec, feature)),
    ])) : {};
    const working = Object.entries(progress).filter(([, row]) => ['in_progress', 'improving', 'blocked', 'needs_recheck'].includes(row.status));
    const checklistText = cached ? renderChecklist(opportunity, cached.spec, progress, siteUrl, unlinkedCount, tests) : '';
    const hasPriorWork = Object.keys(progress).length > 0 || Boolean(memory?.handoffs.length) || (unlinkedCount ?? 0) > 0;
    const needsSetup = Boolean(cached) && (typeof args.has_setup_files === 'boolean' ? !args.has_setup_files : !hasPriorWork);
    const body = [
      project?.repo ? `Repository: ${project.repo}` : 'Repository: not connected',
      !goal && 'No locked goal yet.',
      needsSetup && 'Setup: If AGENTS.md, CLAUDE.md, or .seedup/ are not in the repository yet, call setup_project first.',
      contextText(null, memory),
      working.length && `Active features: ${working.slice(0, 5).map(([id, row]) => `${id} [${row.status}]`).join(', ')}`,
      checklistText,
    ].filter(Boolean).join('\n\n');
    const next = !cached && !key.startsWith('prd:')
      ? toolCall('generate_verified_prd', { project: key })
      : needsSetup
        ? toolCall('setup_project', { project: key })
        : toolCall('get_next_task', { project: key });
    return {
      ...projectReply(`${opportunity.name} (project: ${key})`, goal, body, next),
      ...(cached ? { structuredContent: checklistCard(opportunity, cached.spec, progress, (feature) => featureCriteria(cached.spec, feature), siteUrl, undefined, shortGoal(goal), tests) } : {}),
    };
  }
  if (name === 'setup_project') {
    const [project, goal, cached] = await Promise.all([
      deps.supervisorProject?.(key).catch(() => null),
      deps.projectGoal?.(key).catch(() => null),
      loadSpec().catch(() => null),
    ]);
    if (!cached) {
      return projectReply(
        key.startsWith('prd:')
          ? 'This saved PRD has no readable feature spec. Update it in Seedup.'
          : `No PRD for "${key}" yet. Call generate_verified_prd first.`,
        goal,
        '',
        key.startsWith('prd:') ? toolCall('get_my_prd', { id: key.slice(4) }) : toolCall('generate_verified_prd', { project: key }),
        true,
      );
    }
    const version = briefVersion(key, cached.spec, goal);
    const files: BundleFile[] = [
      { path: 'AGENTS.md', content: renderAgentBrief(cached.input, cached.spec, 'agents', key, { goal, briefVersion: version }) },
      { path: 'CLAUDE.md', content: `${CLAUDE_POINTER}\n${briefVersionInstructions(version)}\n` },
      ...(goal ? hookBundle(key, goal, humanTasks(cached.spec)) : []),
    ];
    const relockUrl = webPages(siteUrl, key);
    const fileList = files.map((file) => `- ${file.path}${file.executable ? ' (executable)' : ''}`).join('\n');
    const notes = goal
      ? [
        '- Claude Code: if .claude/settings.json already exists, merge the hooks block instead of overwriting.',
        '- Codex CLI: hooks in .codex/hooks.json run only after the user reviews and trusts them in /hooks.',
        '- Pre-commit: run `cp .seedup/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` (or add `node .seedup/hook.mjs pre-commit` on Windows / existing hooks).',
        '- No MCP token or path-token is included in any file.',
      ]
      : [
        `- Lock a goal on the web and re-run setup_project to get the local hook bundle: ${relockUrl}`,
        '- Codex CLI: once hooks are added, .codex/hooks.json runs only after the user reviews and trusts them in /hooks.',
        '- No MCP token or path-token is included in any file.',
      ];
    const body = [
      `Files to write to the repository root:\n${fileList}`,
      `Notes:\n${notes.join('\n')}`,
      `\`\`\`json\n${JSON.stringify({ files }, null, 2)}\n\`\`\``,
    ].join('\n\n');
    const outcome = goal
      ? `Prepared ${files.length} repository setup files for ${key}.`
      : `Prepared ${files.length} repository setup files for ${key} (no locked goal yet; hook bundle omitted).`;
    const next = !project?.repo
      ? toolCall('connect_repo', { project: key, repo: '<owner/repo>' })
      : toolCall('get_next_task', { project: key });
    return {
      ...projectReply(outcome, goal, body, next),
      structuredContent: { project: key, goalLocked: Boolean(goal), files },
    };
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
  const relockHint = scopeChange && approved !== false
    ? `Re-lock the goal on the web (MCP has no goal-lock tool): ${webPages(siteUrl, key)}`
    : '';
  const note = scopeChange && approved === null ? [askScope(prdLanguage(), key, featureIds[0]), relockHint].filter(Boolean).join('\n')
    : approval === APPROVED && scopeChange ? `${APPROVED}. Have the user lock the revised goal before implementing the change.\n${relockHint}`
    : approval ?? '';
  return text(`Recorded decision ${saved.id} for ${key}.${note ? `\n${note}` : ''}`);
}

async function callTool(name: string, args: Record<string, unknown>, deps: McpDeps, siteUrl: string): Promise<ToolResult> {
  // Handle user-scoped tools first without loading the full opportunity catalog.
  if (name === 'get_my_prd') {
    const rawId = String(args.id ?? '').trim();
    if (!rawId) {
      const limit = Math.max(1, Math.min(50, Number(args.limit ?? 20) || 20));
      const items = deps.myPrds ? await deps.myPrds(limit) : [];
      return text(renderSavedPrdList(items, siteUrl));
    }
    const id = rawId.replace(/^prd:/i, '');
    const saved = deps.myPrd ? await deps.myPrd(id) : null;
    if (!saved) return text(`Saved PRD "${id}" not found. Call get_my_prd without id first.`, true);
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
    let report: Awaited<ReturnType<McpDeps['validate']>> = null;
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
    const { model, reasoning } = prdOptions(args);
    return text(report.projectKey
      ? `${report.text}\n\n${webLine(siteUrl, report.projectKey)}\n\nThe quotes are saved as your project ${report.projectKey}. Make its PRD next:\n${toolCall('generate_verified_prd', { project: report.projectKey, ...(args.model !== undefined ? { model } : {}), ...(args.reasoning !== undefined ? { reasoning } : {}) })}`
      : report.text);
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
  if (!slug) return projectReply('Provide a project key (public opportunity slug or prd:<id>) as project or slug. Both aliases must agree when present.', null, '', toolCall('get_my_prd', {}), true);
  const personal = slug.startsWith('prd:');
  let saved = personal ? await deps.myPrd?.(slug.slice(4)) : null;
  // A draft validate_idea saved has quotes but no PRD yet: generate_verified_prd makes it (counted like any PRD).
  if (personal && !saved && name === 'generate_verified_prd' && deps.draftPrd) {
    if (!(await deps.consume('mcp_prd', MCP_DAILY_PRD_LIMIT))) return text(`Daily limit reached (${MCP_DAILY_PRD_LIMIT} PRDs). Try again tomorrow.`, true);
    try {
      saved = await deps.draftPrd(slug.slice(4), prdOptions(args));
    } catch {
      await deps.release?.('mcp_prd').catch(() => undefined);
      return text('The model did not answer. Try again in a minute.', true);
    }
    if (!saved) await deps.release?.('mcp_prd').catch(() => undefined);
  }
  const savedBuild = saved ? savedProject(saved, slug) : null;
  const opportunities = personal ? [] : await deps.opportunities();
  const opportunity = personal ? savedBuild?.opportunity : opportunities.find((item) => item.slug === slug);
  if (!opportunity) return projectReply(personal
    ? 'Project not found. A key from validate_idea has no PRD yet: call generate_verified_prd with it first. Otherwise call get_my_prd.'
    : 'Project not found. Call search_opportunities or get_my_prd first.', null, '',
    personal ? toolCall('get_my_prd', {}) : toolCall('search_opportunities', { query: '<topic>' }), true);
  const loadSpec = () => personal ? Promise.resolve(savedBuild?.result ?? null) : resolveSpecForSlug(opportunity, deps);
  if (SUPERVISOR_TOOLS.has(name)) return callSupervisorTool(name, args, opportunity, deps, loadSpec, siteUrl);
  const updatesProgress = name === 'update_feature_status';
  const needsPrd = ['get_next_task', 'verify_feature', 'explain_file'].includes(name) || updatesProgress;
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
        spec = await deps.generate(input, draft, prdOptions(args));
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
    const { sha, message, files: rawFiles, file_statuses: rawFileStatuses, features } = args;
    if (typeof sha !== 'string' || !/^[a-f0-9]{7,40}$/i.test(sha)) return text('SHA must be 7–40 hexadecimal characters.', true);
    if (typeof message !== 'string' || message.length > 500 || message.includes('\0')) return text('Message must be a string of at most 500 characters without null bytes.', true);
    const parsedFiles = parseCommitFiles(rawFiles, rawFileStatuses);
    if (!parsedFiles) return text('Provide up to 200 repository-relative file paths (or { path, status } with added | modified | deleted), each 1–300 characters and without ".." path segments.', true);
    const { files, fileStatuses } = parsedFiles;
    if (features !== undefined && (!Array.isArray(features) || !features.every((id) => typeof id === 'string'))) return text('Features must be an array of feature ids.', true);
    const rawIds: string[] = features ?? message.match(/\bf-?\d+\b/gi) ?? [];
    const featureIds = new Set<string>();
    const cached = rawIds.length ? await loadSpec() : await loadSpec().catch(() => null);
    if (rawIds.length) {
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
    const hasStatuses = Object.keys(fileStatuses).length > 0;
    const commit = { sha: commitSha, message, files, featureIds: [...featureIds], ...(hasStatuses ? { fileStatuses } : {}) };
    await deps.linkCommit(slug, commit);
    const outcome = featureIds.size ? 'Recorded commit for ' + [...featureIds].join(', ') + '.' : 'Recorded commit without a feature link.';
    const goal = await deps.projectGoal?.(slug).catch(() => null);
    const drift = cached ? findDrift([commit], cached.spec, goal ?? null) : [];
    const outsideScope = drift.some((finding) => finding.kind === 'non_goal' || finding.kind === 'out_of_spec');
    const lines: string[] = drift.map((finding) => finding.kind === 'non_goal'
      ? 'Scope warning: the commit may touch a locked exclusion.'
      : finding.kind === 'out_of_spec'
        ? `Drift warning: added files outside the spec (${finding.files.join(', ')}).`
        : 'Drift warning: no feature claims this commit.');
    if (outsideScope) lines.push(askScope(prdLanguage(cached?.spec), slug, commit.featureIds[0]));
    const next = outsideScope ? scopeDecision(slug, commit.featureIds[0])
      : toolCall('resume_project', { project: slug });
    if (!files.length) return projectReply(outcome, goal, lines.join('\n'), next);

    try {
      const [progress, linkedFiles] = await Promise.all([deps.progress(slug), deps.featureFiles(slug, commitSha)]);
      for (const feature of touchedDoneFeatures(progress, linkedFiles, files, featureIds)) {
        try {
          const flagged = await deps.flagRecheck(slug, feature.id, commitSha, `Commit ${commitSha} touched ${feature.files.join(', ')}.`);
          if (flagged) lines.push(`${feature.id} is now needs_recheck: re-run its done criteria (resume_project), then update_feature_status done with checks.`);
        } catch (error) {
          console.error('MCP feature recheck write failed', error);
          lines.push(`Could not flag ${feature.id} for recheck. Retry link_commit.`);
        }
      }
    } catch (error) {
      console.error('MCP feature recheck lookup failed', error);
      lines.push('Could not check for affected features. Retry link_commit.');
    }
    return projectReply(outcome, goal, lines.join('\n'), next);
  }
  if (needsPrd) {
    const cached = await loadSpec();
    if (name === 'get_next_task') return nextTaskResult(opportunity, cached, deps, args.brief);
    if (!cached) return projectReply(personal ? 'This saved PRD has no readable feature spec. Update it in Seedup.' : `No PRD for "${slug}" yet. Call generate_verified_prd first.`,
      await deps.projectGoal?.(slug).catch(() => null), '', toolCall('generate_verified_prd', { project: slug }), true);
    if (name === 'explain_file') {
      return explainFileResult(opportunity, cached, args.path, deps);
    }
    if (name === 'verify_feature') return startFeatureVerification(args, slug, cached.spec, deps);
    if (updatesProgress) return updateBuildStatus(args, opportunity, cached.spec, deps, siteUrl);
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
            text: `Run a focused Seedup build loop for "${slug}":\n1. Call get_next_task {"slug":${JSON.stringify(slug)}}.\n2. Call update_feature_status with status "in_progress" for the returned feature_id.\n3. Implement the feature following its readiness slots and verified quotes.\n4. Run local checks and push the commit. Call link_commit if enabled for this project.\n5. Call verify_feature with the feature and full GitHub SHA, then use its token and the same SHA in update_feature_status done. In non-strict mode you can also report one passing check per criterion.`,
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
            text: `Audit ship readiness for "${slug}":\n1. Call resume_project {"project":${JSON.stringify(slug)}} and check the build checklist for any features in needs_recheck, blocked, or todo.\n2. For any needs_recheck or recently changed feature, call verify_feature with its full pushed GitHub SHA (re-call with the same feature and SHA if running).\n3. Report which features are verified ready, which criteria failed or remain unclear, and whether any unlinked commits need review.`,
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

/** One goal as the MCP initialize instructions list it (recent PRDs with an unmet criterion, two at most). */
export const activeGoalLine = (goal: ProjectGoal) => `- ${goal.projectKey} (v${goal.version}): ${oneLine(goal.statement, 300)}`;

async function activeGoalInstructions(deps: McpDeps) {
  if (!deps.myPrds || !deps.projectGoal) return '';
  // shortcut: use recent saved PRDs to discover keys; switch to a user-wide goal query when the DB layer provides one.
  const saved = (await deps.myPrds(5).catch(() => [])).filter((prd) => prd.hasPrd !== false);
  const keys = [...new Set(saved.flatMap((prd) => [`prd:${prd.id}`, ...(prd.opportunitySlug ? [prd.opportunitySlug] : [])]))];
  const fetchGoal = deps.projectGoal;
  const goals = (await Promise.all(keys.map((key) => fetchGoal(key).catch(() => null))))
    .filter((goal): goal is ProjectGoal => Boolean(goal?.criteria.some((criterion) => criterion.status !== 'met')))
    .sort((a, b) => b.lockedAt.localeCompare(a.lockedAt))
    .slice(0, 2);
  return goals.length ? `\n\nActive locked goals from recent PRDs:\n${goals.map(activeGoalLine).join('\n')}` : '';
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
        instructions: 'Development ([개발]): Start with resume_project (and setup_project if AGENTS.md/.seedup are missing), then get_next_task using project (slug or prd:<id>), one feature at a time. Ask the user in the terminal before any goal or scope change and log it with record_decision. Report status via update_feature_status; verify pushed commits via verify_feature (re-call while running; auto-links commits). Use link_commit for unverified commits and explain_file before editing done files. Planning ([기획]): Search with search_opportunities, inspect with get_opportunity, validate with validate_idea, draft PRDs with generate_verified_prd, or list/read saved PRDs with get_my_prd.'
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
        return reply(withWebLink(await callTool(name, args, deps, siteUrl), name, args, siteUrl));
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
