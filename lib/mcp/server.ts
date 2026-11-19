// Seedup as an MCP server (Streamable HTTP, JSON responses only). The transport is plain JSON-RPC 2.0, so this file
// has no dependency: the route hands it the parsed body and a context with the data sources it may use.
import { appResource, checklistCard, nextTaskCard, opportunitiesCard, prdCard, readAppResource, withAppMeta } from '@/lib/mcp/apps';
import { AGENT_FEATURE_STATUSES, normalizeFeatureId } from '@/lib/opportunities/build-progress';
import type { AgentFeatureStatus, BuildProgress } from '@/lib/opportunities/build-progress';
import { specInputFor } from '@/lib/opportunities/context';
import { PRD_MAX_EVIDENCE } from '@/lib/opportunities/prd-cache';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { EXPORT_FILES, renderAgentBrief, renderSpecMarkdown, SLOT_KEYS, SLOT_LABELS_EN } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecInput } from '@/lib/opportunities/spec';
import type { Evidence, Opportunity } from '@/lib/opportunities/types';

export const MCP_DAILY_PRD_LIMIT = 10;
export const MCP_DAILY_REPORT_LIMIT = 3;
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export type McpDeps = {
  opportunities: () => Promise<Opportunity[]>;
  /** The last good PRD for this exact evidence set, if one was generated before. */
  cachedSpec: (evidenceIds: string[]) => Promise<{ input: SpecInput; spec: Spec } | null>;
  generate: (input: SpecInput, draft: boolean) => Promise<Spec | null>;
  consume: (feature: string, dailyLimit: number) => Promise<boolean>;
  related: (idea: string) => Promise<Array<{ title: string; url: string | null; source: string; similarity: number }>>;
  progress: (slug: string) => Promise<BuildProgress>;
  featureFiles?: (slug: string) => Promise<Record<string, string[]>>;
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

const progressProperties = {
  slug: { type: 'string' },
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

export const TOOLS = [
  {
    name: 'search_opportunities',
    description: 'Search Seedup build opportunities: developer pains with verified quotes from GitHub, Hacker News and Stack Overflow, and how crowded the market is.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords, e.g. "agent memory" or "schema"' }, limit: { type: 'number', minimum: 1, maximum: 10 } }, required: ['query'] },
  },
  {
    name: 'get_opportunity',
    description: 'Full detail of one opportunity: the problem, the gap, every verified quote with its source link, and direct competitors.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'generate_verified_prd',
    description: 'An evidence-traced PRD for one opportunity (evidence → requirements → features → screens) as AGENTS.md, CLAUDE.md, a Cursor rule (.cursor/rules/seedup.mdc), a paste-in prompt for app builders (Lovable, Bolt, v0) or PRD markdown. Every requirement cites a verified quote; below the evidence bar it is labeled a hypothesis draft.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        format: { type: 'string', enum: ['agents', 'claude', 'cursor', 'prompt', 'prd'], description: 'Default agents (AGENTS.md)' },
        fresh: { type: 'boolean', description: 'Generate again instead of returning the last good PRD' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_build_checklist',
    description: 'The build checklist of the PRD made by generate_verified_prd: every feature (F-01, F-02, ...) with its current status and done criteria.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'get_next_task',
    description: 'Call at the start of a session. Picks one ready feature from the cached PRD and includes its done criteria, readiness slots, verified quotes, related files and status calls.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'update_feature_status',
    description: 'Report the current status of a PRD feature. Use in_progress when starting, and done with checks or blocked when ending.',
    inputSchema: {
      type: 'object',
      properties: {
        ...progressProperties,
        feature_id: { type: 'string', description: 'Feature id, e.g. F-01' },
        status: { type: 'string', enum: AGENT_FEATURE_STATUSES },
      },
      required: ['slug', 'feature_id', 'status'],
    },
  },
  {
    name: 'mark_feature_done',
    description: 'Compatibility alias for reporting done with checks or returning a feature to todo.',
    inputSchema: {
      type: 'object',
      properties: {
        ...progressProperties,
        feature: { type: 'string', description: 'Feature id, e.g. F-01' },
        done: { type: 'boolean', description: 'Default true; false sets todo' },
      },
      required: ['slug', 'feature'],
    },
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
  },
  {
    name: 'find_related_content',
    description: 'News, papers, repos and products Seedup collected that are semantically close to an idea, for grounding an evaluation.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
  },
  {
    name: 'validate_idea',
    description: 'Should I build this? A report for one idea: real quotes from GitHub issues, Hacker News and Stack Overflow (kept only when they match the source word for word), the tools that already solve it, how big a first version is for one person, where the first users are, and a verdict on the 3-quotes-from-2-sites bar. Takes about a minute; 3 a day.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string', description: 'The idea in one sentence, any language' } }, required: ['idea'] },
  },
  {
    name: 'watch_idea',
    description: 'Watch one idea: once a week Seedup searches again and mails the user any new quotes or new rival tools for it. Up to 10 ideas.',
    inputSchema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
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
  return `${item.name} (${item.slug}) — ${item.qualified ? 'verified' : 'below evidence bar'}, ${item.evidence.length} quotes on ${item.platforms.join(', ')}, ${item.directCount} direct competitors, status ${item.status}\n  ${item.problem}\n  ${siteUrl}/opportunities/${item.slug}`;
}

function describeQuote(item: Evidence, number: number) {
  return `E-${number} [${item.platform}] "${item.quote}" ${item.url}`;
}

/** Use the same numbered criteria in the checklist and in the tools that record completion. */
export function featureCriteria(spec: Spec, feature: Spec['features'][number]) {
  const served = [...spec.requirements, ...spec.hypotheses].filter((row) => feature.requirementIds.includes(row.id));
  const criteria = [...new Set([...served.flatMap((row) => row.acceptance ?? []), ...(feature.slots?.done ?? [])].map((line) => line.trim()).filter(Boolean))];
  return criteria.length ? criteria : ['Confirm the feature works with a test or command.'];
}

export function pickNextTask(spec: Spec, progress: BuildProgress) {
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

  const priority = { needs_recheck: 0, in_progress: 1, improving: 1, todo: 2, done: 3, blocked: 3 };
  const next = ready.sort((a, b) => priority[a.status] - priority[b.status] ||
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
  const why = status === 'needs_recheck' ? 'This feature needs a recheck.'
    : status === 'todo' ? `Ready to start with ${evidence.length} distinct verified quotes. To-do features are ranked by quote count, then feature number.`
    : 'Resume work already underway.';
  return { feature, status, evidence, why };
}

async function nextTaskResult(opportunity: Opportunity, cached: { input: SpecInput; spec: Spec }, progress: BuildProgress, deps: McpDeps): Promise<ToolResult> {
  const { slug } = opportunity;
  const task = pickNextTask(cached.spec, progress);
  if (!task.feature) return text(`No next task for "${slug}". ${task.why}`);

  const { feature, status, evidence, why } = task;
  const criteria = featureCriteria(cached.spec, feature);
  // The cache key ignores order, but E-n always refers to the order saved with the PRD.
  const quotes = [...evidence].sort((a, b) => a - b).flatMap((number) => {
    const id = cached.input.evidence[number - 1]?.id;
    const quote = opportunity.evidence.find((item) => item.id === id);
    return quote ? [describeQuote(quote, number)] : [];
  });
  const files = (await deps.featureFiles?.(slug))?.[feature.id] ?? [];
  const slots = SLOT_KEYS.map((key) => `- ${SLOT_LABELS_EN[key]}: ${feature.slots?.[key]?.join(' / ') || '(open question)'}`);
  const args = { slug, feature_id: feature.id };
  const checks = criteria.map((_, index) => ({ criterion: index + 1, passed: true, evidence: '' }));
  const note = progress[feature.id]?.note;
  return {
    ...text(`${feature.id} ${feature.title} [${status}]
${feature.detail}
${why}${note ? `\nPrevious status note: ${note}` : ''}

Done when
${criteria.map((line, index) => `${index + 1}. ${line}`).join('\n')}

Readiness slots
${slots.join('\n')}

Verified quotes
${quotes.join('\n') || 'No verified quotes.'}

Related files
${files.join('\n') || '관련 파일 정보 없음'}

Start now
update_feature_status ${JSON.stringify({ ...args, status: 'in_progress' })}

After all criteria pass, fill each evidence field with the passing test or command and its result
update_feature_status ${JSON.stringify({ ...args, status: 'done', checks })}

If blocked, describe what is blocking work
update_feature_status ${JSON.stringify({ ...args, status: 'blocked', note: '<what is blocking work>' })}`),
    structuredContent: nextTaskCard(feature, why, criteria.length, quotes.length, files),
  };
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

export function renderChecklist(opportunity: Opportunity, spec: Spec, progress: BuildProgress, siteUrl: string) {
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
  return `Build checklist for ${opportunity.name} (${opportunity.slug}): ${done}/${spec.features.length} done${spec.draft ? ', hypothesis draft' : ''}
Work on one feature at a time. Call update_feature_status with in_progress when starting and done or blocked when ending. For done, include one passing check with evidence per numbered criterion.
PRD page: ${siteUrl}/prd?opportunity=${encodeURIComponent(opportunity.slug)}

${lines.join('\n\n') || 'This PRD has no features.'}`;
}

/** One kept item as an agent reads it: what it is, why it was kept, and where to open it. Pure, for tests. */
export function renderKept(item: KeptItem) {
  return [`- [${item.type}] ${item.title}${item.extra ? ` (${item.extra})` : ''}`, item.note ? `  ${item.note}` : '', `  ${item.url}`, item.page !== item.url ? `  On Seedup: ${item.page}` : '', `  Kept ${item.savedAt.slice(0, 10)}`].filter(Boolean).join('\n');
}

/** The evidence the site and generate_verified_prd both build from, so all three read the same cached PRD. */
const prdEvidence = (opportunity: Opportunity) => opportunity.evidence.slice(0, PRD_MAX_EVIDENCE);

async function callTool(name: string, args: Record<string, unknown>, deps: McpDeps, siteUrl: string): Promise<ToolResult> {
  const opportunities = await deps.opportunities();
  if (name === 'search_opportunities') {
    const found = searchOpportunities(opportunities, String(args.query ?? ''), Number(args.limit ?? 5));
    if (!found.length) return text('No opportunity matched. Try broader words.');
    return { ...text(found.map((item) => describe(item, siteUrl)).join('\n\n')), structuredContent: opportunitiesCard(found, siteUrl) };
  }
  const slug = String(args.slug ?? '');
  const opportunity = opportunities.find((item) => item.slug === slug);
  const updatesProgress = name === 'update_feature_status' || name === 'mark_feature_done';
  const needsPrd = ['get_build_checklist', 'get_next_task'].includes(name) || updatesProgress;
  if (name === 'get_opportunity' || name === 'generate_verified_prd' || needsPrd) {
    if (!opportunity) return text(`Unknown opportunity "${slug}". Call search_opportunities first.`, true);
  }
  if (name === 'get_opportunity' && opportunity) {
    const quotes = opportunity.evidence.map((item, index) => describeQuote(item, index + 1)).join('\n');
    const rivals = opportunity.supply.filter((item) => item.relation === 'direct').map((item) => `- ${item.name} ${item.url}`).join('\n');
    return text(`${describe(opportunity, siteUrl)}\n\nGap: ${opportunity.gap || 'unknown'}\n\nVerified quotes:\n${quotes}\n\nDirect competitors:\n${rivals || '- none found'}`);
  }
  if (name === 'generate_verified_prd' && opportunity) {
    const format = (['agents', 'claude', 'cursor', 'prompt', 'prd'].includes(String(args.format)) ? String(args.format) : 'agents') as ExportFormat | 'prd';
    const picked = prdEvidence(opportunity).map((evidence) => ({ evidence, slug }));
    const ids = picked.map((item) => item.evidence.id);
    let result = args.fresh ? null : await deps.cachedSpec(ids);
    if (!result) {
      const input = specInputFor(opportunities, picked);
      if (!input) return text('This opportunity has no quotes yet.', true);
      if (!(await deps.consume('mcp_prd', MCP_DAILY_PRD_LIMIT))) return text(`Daily limit reached (${MCP_DAILY_PRD_LIMIT} PRDs). Try again tomorrow.`, true);
      const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
      const spec = await deps.generate(input, draft);
      if (!spec) return text('The model did not answer. Try again in a minute.', true);
      result = { input, spec };
    }
    const body = format === 'prd' ? renderSpecMarkdown(result.input, result.spec) : renderAgentBrief(result.input, result.spec, format, slug);
    return { ...text(format === 'prd' ? body : `Save as ${EXPORT_FILES[format]}:\n\n${body}`), structuredContent: prdCard(opportunity, result.spec, siteUrl) };
  }
  if (needsPrd && opportunity) {
    const cached = await deps.cachedSpec(prdEvidence(opportunity).map((item) => item.id));
    if (!cached) return text(`No PRD for "${slug}" yet. Call generate_verified_prd first.`, true);
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
    const progress = await deps.progress(slug);
    if (name === 'get_next_task') return nextTaskResult(opportunity, cached, progress, deps);
    return { ...text(renderChecklist(opportunity, cached.spec, progress, siteUrl)), structuredContent: checklistCard(opportunity, cached.spec, progress, (feature) => featureCriteria(cached.spec, feature), siteUrl) };
  }
  if (name === 'get_kept_items') {
    const type = (KEPT_TYPES as readonly string[]).includes(String(args.type)) ? (String(args.type) as KeptType) : null;
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 20) || 20));
    const items = await deps.kept(type, limit);
    if (!items.length) return text(type === 'github' ? `No kept repositories yet. Keep one from ${siteUrl}/news?tab=github.` : `Nothing kept yet. Keep repositories and articles on ${siteUrl}/news.`);
    return text(`${items.length} kept item${items.length === 1 ? '' : 's'}, newest first:\n\n${items.map(renderKept).join('\n\n')}`);
  }
  if (name === 'validate_idea') {
    const idea = String(args.idea ?? '').trim().slice(0, 300);
    if (idea.length < 4) return text('Describe the idea in a sentence.', true);
    if (!(await deps.consume('mcp_report', MCP_DAILY_REPORT_LIMIT))) return text(`Daily limit reached (${MCP_DAILY_REPORT_LIMIT} reports). Try again tomorrow.`, true);
    const report = await deps.validate(idea);
    return report ? text(report) : text('The report could not be made. Try again in a minute.', true);
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
  return text(`Unknown tool "${name}".`, true);
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
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'seedup', version: '1.0.0' },
        instructions: 'Seedup finds build opportunities from verified quotes and turns them into evidence-traced PRDs. Search first, then generate_verified_prd and save the result in the repo. At the start of each build session, call get_next_task with the opportunity slug and build one feature at a time. Use update_feature_status to report in_progress when starting and done with checks or blocked when ending.',
      });
    }
    case 'ping':
      return reply({});
    // The only resource is the MCP Apps card (lib/mcp/apps.ts).
    case 'resources/list':
      return reply({ resources: [appResource] });
    case 'resources/read': {
      const resource = readAppResource(message.params?.uri);
      return resource ? reply(resource) : fail(-32002, `Resource not found: ${String(message.params?.uri ?? '')}`);
    }
    // No templates or prompts, but some clients list them anyway and treat an error as a broken server.
    case 'resources/templates/list':
      return reply({ resourceTemplates: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
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
    const answers = (await Promise.all(body.map((item) => handleOne((item ?? {}) as RpcRequest, deps, siteUrl)))).filter(Boolean);
    return answers.length ? answers : null;
  }
  if (!body || typeof body !== 'object') return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
  return handleOne(body as RpcRequest, deps, siteUrl);
}
