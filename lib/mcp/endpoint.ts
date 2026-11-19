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
import { addWatch } from '@/lib/db/watches';
import { onboardingRow } from '@/lib/db/onboarding';
import { sendWebhook } from '@/lib/newsletter/webhooks';
import { NextResponse } from 'next/server';

const unauthorized = () => NextResponse.json(
  { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid token. Create one at /agents (MCP 연동).' } },
  { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
);

/**
 * The MCP endpoint: a personal token, not a Supabase session, says who is calling, so it runs with the service key and
 * every data call below names that user. Streamable HTTP, JSON responses only (no server-sent events).
 * `pathKey` is the token taken from /api/mcp/<token>, for apps whose connector form has no header field.
 */
export async function handleMcpRequest(request: Request, pathKey?: string) {
  const service = createAdminClient();
  if (!service) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Server is not configured' } }, { status: 503 });
  const userId = await userForToken(service, pathKey ? `Bearer ${pathKey}` : request.headers.get('authorization'));
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
    related: async (idea) => (await retrieveIdeaContext(idea, { maxReferences: 6, syncMissing: false, throwOnError: true })).map((row) => ({
      title: String(row.metadata.title ?? row.source_table),
      url: row.metadata.url ?? null,
      source: String(row.metadata.source ?? row.source_table),
      similarity: row.similarity,
    })),
    progress: (slug) => readBuildProgress(service, userId, slug),
    setProgress: (slug, feature, status, note) => writeBuildProgress(service, userId, slug, feature, status, note),
    notifyBlocked: async (opportunity, feature) => {
      const settings = await onboardingRow<{ notify_webhook: string | null }>(service, userId, 'notify_webhook');
      if (settings?.notify_webhook) {
        await sendWebhook(settings.notify_webhook, `${opportunity.name} · 기능 막힘`, `${feature.id} ${feature.title}\n${siteUrl}/prd?opportunity=${encodeURIComponent(opportunity.slug)}`);
      }
    },
    kept: (type, limit) => readKept(service, userId, type, limit, siteUrl),
    validate: async (idea) => {
      const { opportunities } = await getOpportunities();
      const report = await buildValidationReport(idea, opportunities).catch(() => null);
      return report ? renderReport(report, siteUrl) : null;
    },
    watch: async (idea) => typeof (await addWatch(service, userId, idea)) === 'object',
  };
  const answer = await handleRpc(body, deps, siteUrl);
  return answer === null ? new Response(null, { status: 202 }) : NextResponse.json(answer);
}
