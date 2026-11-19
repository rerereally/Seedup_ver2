// Seedup as an MCP server (Streamable HTTP, JSON responses only). The transport is plain JSON-RPC 2.0, so this file
// has no dependency: the route hands it the parsed body and a context with the data sources it may use.
import { normalizeFeatureId } from '@/lib/opportunities/build-progress';
import type { BuildProgress } from '@/lib/opportunities/build-progress';
import { specInputFor } from '@/lib/opportunities/context';
import { PRD_MAX_EVIDENCE } from '@/lib/opportunities/prd-cache';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { EXPORT_FILES, renderAgentBrief, renderSpecMarkdown } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecInput } from '@/lib/opportunities/spec';
import type { Opportunity } from '@/lib/opportunities/types';

export const MCP_DAILY_PRD_LIMIT = 10;
export const MCP_DAILY_REPORT_LIMIT = 3;
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export type McpDeps = {
  opportunities: () => Promise<Opportunity[]>;
  /** The last good PRD for this exact evidence set, if one was generated before. */
  cachedSpec: (evidenceIds: string[]) => Promise<{ input: SpecInput; spec: Spec } | null>;
  generate: (input: SpecInput, draft: boolean) => Promise<Spec | null>;
  consume: (feature: string, dailyLimit: number) => Promise<boolean>;
  related: (idea: string) => Promise<Array<{ title: string; url: string | null; source: string; similarity: number }>>;
  /** This user's done features for one opportunity. */
  progress: (slug: string) => Promise<BuildProgress>;
  setProgress: (slug: string, feature: { id: string; title: string }, done: boolean, note: string) => Promise<void>;
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
type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

const text = (value: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: value }], ...(isError ? { isError } : {}) });

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
    description: 'The build checklist of the PRD made by generate_verified_prd: every feature (F-01, F-02, ...) with its done criteria and whether it is already marked done. Build one feature at a time and check it against these criteria.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'mark_feature_done',
    description: 'Mark one PRD feature as done (or not done) once its done criteria pass. The progress shows on the PRD page of the Seedup site.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        feature: { type: 'string', description: 'Feature id, e.g. F-01' },
        done: { type: 'boolean', description: 'Default true; false clears the mark' },
        note: { type: 'string', description: 'One line on what was built or how it was checked' },
        checks: {
          type: 'array',
          description: 'One entry per done criterion listed for this feature by get_build_checklist (numbered from 1). A feature is marked done only when every criterion has a passing check with evidence.',
          items: {
            type: 'object',
            properties: {
              criterion: { type: 'number', description: 'The criterion number from get_build_checklist' },
              passed: { type: 'boolean' },
              evidence: { type: 'string', description: 'How it was checked: the test name and its result, or the command and its output, in one line' },
            },
            required: ['criterion', 'passed', 'evidence'],
          },
        },
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

/** The checklist an agent works through: one box per feature, its done criteria under it. Pure, for tests. */
/**
 * What "done" means for one feature: the acceptance criteria of every requirement it serves, then its own readiness
 * "done" slot. The numbering here is what mark_feature_done's checks refer to.
 */
export function featureCriteria(spec: Spec, feature: Spec['features'][number]) {
  const served = [...spec.requirements, ...spec.hypotheses].filter((row) => feature.requirementIds.includes(row.id));
  return [...new Set([...served.flatMap((row) => row.acceptance ?? []), ...(feature.slots?.done ?? [])].map((line) => line.trim()).filter(Boolean))];
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
  const done = spec.features.filter((feature) => progress[feature.id]).length;
  const lines = spec.features.map((feature) => {
    const mark = progress[feature.id];
    const list = featureCriteria(spec, feature);
    const criteria = list.length
      ? list.map((line, index) => `    ${index + 1}. ${line}`).join('\n')
      : '    - (no done criteria yet: fill the blanks for this feature on the PRD page, or write tests that prove the detail above)';
    return `- [${mark ? 'x' : ' '}] ${feature.id} ${feature.title} (serves ${feature.requirementIds.join(', ') || '-'})
    ${feature.detail}
  Done when:
${criteria}${mark?.note ? `\n  Note: ${mark.note}` : ''}`;
  });
  return `Build checklist for ${opportunity.name} (${opportunity.slug}): ${done}/${spec.features.length} done${spec.draft ? ', hypothesis draft' : ''}
Work on one unchecked feature at a time. When its criteria pass, call mark_feature_done with its id and one check per numbered criterion (passed, and the test or command that proved it).
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
    return text(found.length ? found.map((item) => describe(item, siteUrl)).join('\n\n') : 'No opportunity matched. Try broader words.');
  }
  const slug = String(args.slug ?? '');
  const opportunity = opportunities.find((item) => item.slug === slug);
  if (['get_opportunity', 'generate_verified_prd', 'get_build_checklist', 'mark_feature_done'].includes(name)) {
    if (!opportunity) return text(`Unknown opportunity "${slug}". Call search_opportunities first.`, true);
  }
  if (name === 'get_opportunity' && opportunity) {
    const quotes = opportunity.evidence.map((item, index) => `E-${index + 1} [${item.platform}] "${item.quote}" ${item.url}`).join('\n');
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
    const body = format === 'prd' ? renderSpecMarkdown(result.input, result.spec) : renderAgentBrief(result.input, result.spec, format);
    return text(format === 'prd' ? body : `Save as ${EXPORT_FILES[format]}:\n\n${body}`);
  }
  if ((name === 'get_build_checklist' || name === 'mark_feature_done') && opportunity) {
    const cached = await deps.cachedSpec(prdEvidence(opportunity).map((item) => item.id));
    if (!cached) return text(`No PRD for "${slug}" yet. Call generate_verified_prd first.`, true);
    if (name === 'mark_feature_done') {
      const id = normalizeFeatureId(String(args.feature ?? ''));
      const feature = id ? cached.spec.features.find((row) => row.id === id) : undefined;
      if (!feature) return text(`Unknown feature "${String(args.feature ?? '')}". Features: ${cached.spec.features.map((row) => row.id).join(', ') || 'none'}.`, true);
      const note = String(args.note ?? '').trim();
      if (args.done === false) {
        await deps.setProgress(slug, feature, false, note);
      } else {
        const criteria = featureCriteria(cached.spec, feature);
        const { unmet, passing } = unmetCriteria(criteria, args.checks);
        if (unmet.length) return text(`${feature.id} is not marked done: ${unmet.length} of ${criteria.length} criteria have no passing check.\n${unmet.map(({ n, line }) => `  ${n}. ${line}`).join('\n')}\nCheck each one (a test or a command), then call mark_feature_done again with checks: [{ criterion, passed: true, evidence }].`, true);
        const proof = passing.map((check) => `${check.criterion}: ${check.evidence}`).join('; ');
        await deps.setProgress(slug, feature, true, [note, proof && `checks ${passing.length}/${criteria.length} (${proof})`].filter(Boolean).join(' · ').slice(0, 600));
      }
    }
    return text(renderChecklist(opportunity, cached.spec, await deps.progress(slug), siteUrl));
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
        capabilities: { tools: {} },
        serverInfo: { name: 'seedup', version: '1.0.0' },
        instructions: 'Seedup finds build opportunities from verified quotes and turns them into evidence-traced PRDs. Search first, then generate_verified_prd and save the result in the repo. Then call get_build_checklist, build one feature at a time, and call mark_feature_done when its done criteria pass.',
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
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
