import { consumeUsageFor, userForToken } from '@/lib/mcp/auth';
import { handleRpc } from '@/lib/mcp/server';
import type { McpDeps } from '@/lib/mcp/server';
import { getOpportunities } from '@/lib/opportunities/data';
import { readBuildProgress, writeBuildProgress } from '@/lib/opportunities/build-progress';
import { generatePrd } from '@/lib/opportunities/prd';
import { readPrdCache, writePrdCache } from '@/lib/opportunities/prd-cache';
import { retrieveIdeaContext } from '@/lib/ingest/rag';
import { createAdminClient } from '@/lib/supabase/admin';
import { readKept } from '@/lib/mcp/kept';
import { buildValidationReport, renderReport } from '@/lib/opportunities/report';
import { MAX_WATCHES_PER_USER } from '@/lib/opportunities/watch';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const unauthorized = () => NextResponse.json(
  { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid token. Create one at /profile (MCP 연결).' } },
  { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
);

/** Streamable HTTP MCP endpoint, JSON responses only (no server-sent events). */
export async function POST(request: Request) {
  const service = createAdminClient();
  if (!service) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Server is not configured' } }, { status: 503 });
  const userId = await userForToken(service, request.headers.get('authorization'));
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => undefined);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  const deps: McpDeps = {
    opportunities: async () => (await getOpportunities()).opportunities,
    cachedSpec: (ids) => readPrdCache(service, ids),
    generate: async (input, draft) => {
      const result = await generatePrd(input, { draft }).catch(() => null);
      if (result) await writePrdCache(service, input.evidence.map((item) => item.id), input, result.spec);
      return result?.spec ?? null;
    },
    consume: (feature, limit) => consumeUsageFor(service, userId, feature, limit),
    related: async (idea) => (await retrieveIdeaContext(idea, { maxReferences: 6, syncMissing: false })).map((row) => ({
      title: String(row.metadata.title ?? row.source_table),
      url: row.metadata.url ?? null,
      source: String(row.metadata.source ?? row.source_table),
      similarity: row.similarity,
    })),
    progress: (slug) => readBuildProgress(service, userId, slug),
    setProgress: (slug, feature, done, note) => writeBuildProgress(service, userId, slug, feature, done, note),
    kept: (type, limit) => readKept(service, userId, type, limit, siteUrl),
    validate: async (idea) => {
      const { opportunities } = await getOpportunities();
      const report = await buildValidationReport(idea, opportunities).catch(() => null);
      return report ? renderReport(report, siteUrl) : null;
    },
    watch: async (idea) => {
      const { count } = await service.from('idea_watches').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if ((count ?? 0) >= MAX_WATCHES_PER_USER) return false;
      const { error } = await service.from('idea_watches').upsert({ user_id: userId, idea }, { onConflict: 'user_id,idea', ignoreDuplicates: true });
      return !error;
    },
  };
  const answer = await handleRpc(body, deps, siteUrl);
  return answer === null ? new Response(null, { status: 202 }) : NextResponse.json(answer);
}

export async function GET() {
  return new Response('Use POST. This server answers with JSON and does not open an event stream.', { status: 405, headers: { Allow: 'POST' } });
}
