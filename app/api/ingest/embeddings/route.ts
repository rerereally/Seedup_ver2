import { assertIngestAuth } from '@/lib/ingest/auth';
import { syncRagEmbeddings } from '@/lib/ingest/rag';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function clamp(value: string | null, fallback: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.floor(number), max) : fallback;
}

// Fills content_embeddings so idea evaluation (RAG) can find newly collected content.
// Backfill: call repeatedly with a large perSource until `remaining` is 0.
async function handle(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const params = new URL(request.url).searchParams;
  const perSource = clamp(params.get('perSource'), 40, 1_000);
  const maxDocuments = clamp(params.get('max'), 60, 200);
  const startedAt = Date.now();
  const result = await syncRagEmbeddings({ perSource, maxDocuments });
  if (!result) return NextResponse.json({ error: 'SUPABASE_SECRET_KEY or OPENROUTER_API_KEY is not configured' }, { status: 503 });

  const supabase = createAdminClient();
  if (supabase) {
    await recordIngestRun(supabase, {
      source: 'embeddings',
      status: result.failed === 0 ? 'success' : getRunStatus(result.failed, result.embedded),
      inserted: result.embedded,
      skipped: result.remaining,
      errors: result.failed,
      durationMs: Date.now() - startedAt,
      detail: { perSource, maxDocuments, ...result },
    });
  }

  const ok = result.failed === 0;
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 207 });
}

export const GET = handle;
export const POST = handle;
