import { assertIngestAuth } from '@/lib/ingest/auth';
import { generateProjectIdea } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

async function ingest(request: Request) {
  const startedAt = Date.now();
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  let upserted = 0;
  let errors = 0;

  const [{ data: news }, { data: products }, { data: repos }] = await Promise.all([
    supabase.from('news_items').select('id,title,short_summary,beginner_summary,project_idea,related_skills,topic_tags,skill_tags,category').order('daily_rank_score', { ascending: false, nullsFirst: false }).order('published_at', { ascending: false }).limit(limit),
    supabase.from('ai_products').select('id,name,short_summary,description,category,topic_tags,skill_tags,use_cases,related_project_ideas').order('newsletter_priority', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(limit),
    supabase.from('github_trends').select('id,repo_full_name,short_summary,beginner_summary,project_idea,language,topics,topic_tags,skill_tags').order('newsletter_priority', { ascending: false, nullsFirst: false }).order('stars', { ascending: false }).limit(limit),
  ]);

  const sources = [
    ...(news ?? []).map((item) => ({
      sourceType: 'news',
      sourceId: item.id,
      title: item.project_idea || item.title,
      summary: item.short_summary || item.beginner_summary || item.title,
      trend: pickSpecificTrend([...(item.topic_tags ?? []), item.category]),
      skills: [...(item.skill_tags ?? []), ...(item.related_skills ?? [])],
    })),
    ...(products ?? []).map((item) => ({
      sourceType: 'ai_product',
      sourceId: item.id,
      title: item.related_project_ideas?.[0] || `${item.name} 참고 프로젝트`,
      summary: item.short_summary || item.description || item.name,
      trend: pickSpecificTrend([...(item.topic_tags ?? []), item.category, ...(item.use_cases ?? [])]),
      skills: [...(item.skill_tags ?? []), ...(item.use_cases ?? [])],
    })),
    ...(repos ?? []).map((item) => ({
      sourceType: 'github',
      sourceId: item.id,
      title: item.project_idea || `${item.repo_full_name} 참고 프로젝트`,
      summary: item.short_summary || item.beginner_summary || item.repo_full_name,
      trend: pickSpecificTrend([...(item.topic_tags ?? []), ...(item.topics ?? [])]),
      skills: [...(item.skill_tags ?? []), ...(item.topics ?? []), item.language].filter(Boolean),
    })),
  ].slice(0, limit * 3);

  for (const source of sources) {
    const { idea } = await generateProjectIdea(source);
    const { error } = await upsertProjectIdea(supabase, source, {
        title: idea.title,
        description: idea.description,
        level: idea.level,
        duration_days: idea.duration_days,
        stack: idea.stack,
        related_trend: idea.related_trend,
        source_type: source.sourceType,
        source_id: source.sourceId,
        target_user_level: idea.target_user_level,
        recommended_for: idea.recommended_for,
        portfolio_value: idea.portfolio_value,
        plan: idea.plan,
        duration_estimate: idea.duration_estimate ?? null,
        scope: idea.scope ?? null,
        build_plan: idea.build_plan ?? null,
        prerequisites: idea.prerequisites ?? [],
        difficulty_reasons: idea.difficulty_reasons ?? [],
        mvp_acceptance: idea.mvp_acceptance ?? null,
        expansion_ideas: idea.expansion_ideas ?? [],
        stack_details: idea.stack_details ?? [],
      });

    if (error) {
      errors += 1;
      console.error('Project idea upsert failed', source.sourceType, source.title, error);
    } else {
      upserted += 1;
    }
  }

  await recordIngestRun(supabase, {
    source: 'project-ideas',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped: 0,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { limit, sources: sources.length },
  });

  return NextResponse.json({ ok: true, upserted, errors });
}

async function upsertProjectIdea(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  source: { sourceType: string; sourceId: string },
  payload: Record<string, unknown>,
) {
  const insertPayload = { ...payload, source_type: source.sourceType, source_id: source.sourceId };
  const result = await supabase
    .from('project_ideas')
    .upsert(insertPayload, { onConflict: 'source_type,source_id,title' });

  if (!result.error || !/unique|conflict|constraint/i.test(result.error.message)) return result;

  // Older Supabase schemas can be missing the composite unique index. Keep the
  // ingestion working while schema.sql is being applied.
  const { data: existing, error: lookupError } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('source_type', source.sourceType)
    .eq('source_id', source.sourceId)
    .eq('title', String(payload.title ?? ''))
    .maybeSingle();

  if (lookupError) return { error: lookupError };
  if (existing?.id) return supabase.from('project_ideas').update(insertPayload).eq('id', existing.id);
  return supabase.from('project_ideas').insert(insertPayload);
}

const GENERIC_TREND_TERMS = new Set([
  'ai',
  'llm',
  'python',
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node.js',
  'api',
  'github',
  'open source',
  'developer',
  'development',
  'software',
  'code',
  'coding',
  'data',
  'model',
  'tool',
  'tools',
  'product',
  'news',
  '개발',
  '기술',
  '뉴스',
  '데이터',
  '모델',
  '도구',
]);

function pickSpecificTrend(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value && !GENERIC_TREND_TERMS.has(value.toLowerCase()))) ?? null;
}
