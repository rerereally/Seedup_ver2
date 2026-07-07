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
    supabase.from('news_items').select('id,title,beginner_summary,project_idea,related_skills,category').order('published_at', { ascending: false }).limit(limit),
    supabase.from('ai_products').select('id,name,description,category,use_cases,related_project_ideas').order('created_at', { ascending: false }).limit(limit),
    supabase.from('github_trends').select('id,repo_full_name,beginner_summary,project_idea,language,topics').order('stars', { ascending: false }).limit(limit),
  ]);

  const sources = [
    ...(news ?? []).map((item) => ({
      sourceType: 'news',
      sourceId: item.id,
      title: item.project_idea || item.title,
      summary: item.beginner_summary || item.title,
      trend: item.category,
      skills: item.related_skills ?? [],
    })),
    ...(products ?? []).map((item) => ({
      sourceType: 'ai_product',
      sourceId: item.id,
      title: item.related_project_ideas?.[0] || `${item.name} 참고 프로젝트`,
      summary: item.description || item.name,
      trend: item.category,
      skills: item.use_cases ?? [],
    })),
    ...(repos ?? []).map((item) => ({
      sourceType: 'github',
      sourceId: item.id,
      title: item.project_idea || `${item.repo_full_name} 참고 프로젝트`,
      summary: item.beginner_summary || item.repo_full_name,
      trend: item.language,
      skills: item.topics ?? [],
    })),
  ].slice(0, limit * 3);

  for (const source of sources) {
    const { idea } = await generateProjectIdea(source);
    const { error } = await supabase.from('project_ideas').upsert(
      {
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
      },
      { onConflict: 'source_type,source_id,title' },
    );

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
