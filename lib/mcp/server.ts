// Seedup as an MCP server (Streamable HTTP, JSON responses only). The transport is plain JSON-RPC 2.0, so this file
// has no dependency: the route hands it the parsed body and a context with the data sources it may use.
import { specInputFor } from '@/lib/opportunities/context';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { EXPORT_FILES, renderAgentBrief, renderSpecMarkdown } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecInput } from '@/lib/opportunities/spec';
import type { Opportunity } from '@/lib/opportunities/types';

export const MCP_DAILY_PRD_LIMIT = 10;
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export type McpDeps = {
  opportunities: () => Promise<Opportunity[]>;
  /** The last good PRD for this exact evidence set, if one was generated before. */
  cachedSpec: (evidenceIds: string[]) => Promise<{ input: SpecInput; spec: Spec } | null>;
  generate: (input: SpecInput, draft: boolean) => Promise<Spec | null>;
  consume: (feature: string, dailyLimit: number) => Promise<boolean>;
  related: (idea: string) => Promise<Array<{ title: string; url: string | null; source: string; similarity: number }>>;
};

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
    description: 'An evidence-traced PRD for one opportunity (evidence → requirements → features → screens) as AGENTS.md, CLAUDE.md, .cursorrules or PRD markdown. Every requirement cites a verified quote; below the evidence bar it is labeled a hypothesis draft.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        format: { type: 'string', enum: ['agents', 'claude', 'cursor', 'prd'], description: 'Default agents (AGENTS.md)' },
        fresh: { type: 'boolean', description: 'Generate again instead of returning the last good PRD' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'find_related_content',
    description: 'News, papers, repos and products Seedup collected that are semantically close to an idea, for grounding an evaluation.',
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

async function callTool(name: string, args: Record<string, unknown>, deps: McpDeps, siteUrl: string): Promise<ToolResult> {
  const opportunities = await deps.opportunities();
  if (name === 'search_opportunities') {
    const found = searchOpportunities(opportunities, String(args.query ?? ''), Number(args.limit ?? 5));
    return text(found.length ? found.map((item) => describe(item, siteUrl)).join('\n\n') : 'No opportunity matched. Try broader words.');
  }
  const slug = String(args.slug ?? '');
  const opportunity = opportunities.find((item) => item.slug === slug);
  if (name === 'get_opportunity' || name === 'generate_verified_prd') {
    if (!opportunity) return text(`Unknown opportunity "${slug}". Call search_opportunities first.`, true);
  }
  if (name === 'get_opportunity' && opportunity) {
    const quotes = opportunity.evidence.map((item, index) => `E-${index + 1} [${item.platform}] "${item.quote}" ${item.url}`).join('\n');
    const rivals = opportunity.supply.filter((item) => item.relation === 'direct').map((item) => `- ${item.name} ${item.url}`).join('\n');
    return text(`${describe(opportunity, siteUrl)}\n\nGap: ${opportunity.gap || 'unknown'}\n\nVerified quotes:\n${quotes}\n\nDirect competitors:\n${rivals || '- none found'}`);
  }
  if (name === 'generate_verified_prd' && opportunity) {
    const format = (['agents', 'claude', 'cursor', 'prd'].includes(String(args.format)) ? String(args.format) : 'agents') as ExportFormat | 'prd';
    const picked = opportunity.evidence.slice(0, 12).map((evidence) => ({ evidence, slug }));
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
  if (name === 'find_related_content') {
    const idea = String(args.idea ?? '').trim().slice(0, 500);
    if (idea.length < 5) return text('Describe the idea in a sentence.', true);
    const rows = await deps.related(idea);
    return text(rows.length ? rows.map((row) => `- ${row.title} (${row.source}, similarity ${row.similarity.toFixed(2)})${row.url ? ` ${row.url}` : ''}`).join('\n') : 'Nothing similar was collected yet.');
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
        instructions: 'Seedup finds build opportunities from verified developer quotes and turns them into evidence-traced PRDs. Search first, then generate_verified_prd and save the result in the repo.',
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
