import { assertIngestAuth } from '@/lib/ingest/auth';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const FETCH_TIMEOUT_MS = 18_000;

type RankingKind = 'popular' | 'intelligence' | 'arena';

type OpenRouterModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
  supported_parameters?: unknown;
  benchmarks?: Record<string, unknown> | null;
  top_provider?: { throughput?: unknown; latency?: unknown } | null;
};

type ModelSnapshot = {
  snapshot_date: string;
  model_id: string;
  model_name: string;
  provider: string;
  popularity_rank: number | null;
  intelligence_rank: number | null;
  intelligence_score: number | null;
  arena_rank: number | null;
  arena_elo: number | null;
  context_length: number | null;
  prompt_price: number | null;
  completion_price: number | null;
  throughput: number | null;
  latency: number | null;
  supported_parameters: string[];
  metadata: Record<string, unknown>;
  fetched_at: string;
};

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = Date.now();
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    await recordIngestRun(supabase, {
      source: 'model-intelligence', status: 'failed', errors: 1, durationMs: Date.now() - startedAt,
      detail: { reason: 'missing_openrouter_api_key' },
    });
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is required' }, { status: 500 });
  }

  const limit = clampLimit(process.env.INGEST_OPENROUTER_MODEL_LIMIT);
  const rankings = await Promise.allSettled(([
    ['popular', 'most-popular'],
    ['intelligence', 'intelligence-high-to-low'],
    ['arena', 'design-arena-elo-high-to-low'],
  ] as const).map(async ([kind, sort]) => [kind, await fetchModels(apiKey, sort, limit)] as const));

  const successful = rankings.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const errors = rankings.length - successful.length;
  const snapshot = mergeRankings(successful, limit);
  let inserted = 0;

  if (snapshot.length) {
    const { error } = await supabase.from('ai_model_snapshots').upsert(snapshot, { onConflict: 'snapshot_date,model_id' });
    if (error) {
      console.error('OpenRouter model snapshot upsert failed', error);
    } else {
      inserted = snapshot.length;
    }
  }

  const totalErrors = errors + (snapshot.length && !inserted ? 1 : 0);
  await recordIngestRun(supabase, {
    source: 'model-intelligence',
    status: getRunStatus(totalErrors, inserted),
    inserted,
    errors: totalErrors,
    durationMs: Date.now() - startedAt,
    detail: { limit, rankings: successful.map(([kind, models]) => ({ kind, models: models.length })) },
  });

  return NextResponse.json({ ok: totalErrors === 0, inserted, errors: totalErrors, rankings: successful.map(([kind, models]) => ({ kind, models: models.length })) });
}

async function fetchModels(apiKey: string, sort: string, limit: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = new URL(OPENROUTER_MODELS_URL);
    url.searchParams.set('sort', sort);
    url.searchParams.set('output_modalities', 'text');
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}`, 'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000', 'x-title': 'Seedup' },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenRouter models request failed: ${response.status}`);
    const json = await response.json() as { data?: OpenRouterModel[] };
    return (json.data ?? []).filter((model) => typeof model.id === 'string').slice(0, limit);
  } finally {
    clearTimeout(timeout);
  }
}

function mergeRankings(rankings: Array<readonly [RankingKind, OpenRouterModel[]]>, limit: number): ModelSnapshot[] {
  const byModel = new Map<string, { model: OpenRouterModel; ranks: Partial<Record<RankingKind, number>> }>();
  for (const [kind, models] of rankings) {
    models.forEach((model, index) => {
      const id = String(model.id);
      const current = byModel.get(id) ?? { model, ranks: {} };
      current.ranks[kind] = index + 1;
      byModel.set(id, current);
    });
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const fetchedAt = new Date().toISOString();
  return [...byModel.entries()].slice(0, limit * 3).map(([modelId, { model, ranks }]) => {
    const benchmarks = model.benchmarks ?? {};
    return {
      snapshot_date: snapshotDate,
      model_id: modelId,
      model_name: typeof model.name === 'string' ? model.name : modelId,
      provider: modelId.split('/')[0] ?? 'unknown',
      popularity_rank: ranks.popular ?? null,
      intelligence_rank: ranks.intelligence ?? null,
      intelligence_score: findMetric(benchmarks, /artificial.*analysis.*intelligence|intelligence.*index/i),
      arena_rank: ranks.arena ?? null,
      arena_elo: findMetric(benchmarks, /design.*arena.*elo|arena.*elo/i),
      context_length: finiteNumber(model.context_length),
      prompt_price: finiteNumber(model.pricing?.prompt),
      completion_price: finiteNumber(model.pricing?.completion),
      throughput: finiteNumber(model.top_provider?.throughput),
      latency: finiteNumber(model.top_provider?.latency),
      supported_parameters: Array.isArray(model.supported_parameters) ? model.supported_parameters.filter((item): item is string => typeof item === 'string') : [],
      metadata: { benchmarks },
      fetched_at: fetchedAt,
    };
  });
}

function findMetric(value: Record<string, unknown>, pattern: RegExp): number | null {
  for (const [key, candidate] of Object.entries(value)) {
    if (pattern.test(key)) return finiteNumber(candidate);
  }
  return null;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampLimit(value: string | undefined) {
  const number = Number(value ?? 20);
  return Number.isFinite(number) ? Math.min(50, Math.max(10, Math.floor(number))) : 20;
}
