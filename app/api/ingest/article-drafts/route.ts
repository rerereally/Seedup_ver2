import { assertIngestAuth } from '@/lib/ingest/auth';
import { generateProjectIdea } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type SourceItem = {
  sourceType: 'news' | 'ai_product' | 'github' | 'paper' | 'trend_bundle';
  sourceId: string;
  title: string;
  summary: string;
  trend: string | null;
  skills: string[];
};

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
  const limit = Number(url.searchParams.get('limit') ?? 6);
  const [newsResult, productsResult, reposResult, papersResult, trendsResult] = await Promise.all([
    supabase
      .from('news_items')
      .select('id,title,short_summary,beginner_summary,summary,newsletter_section,newsletter_priority,topic_tags,skill_tags,related_skills,project_idea,category')
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('daily_rank_score', { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from('ai_products')
      .select('id,name,short_summary,description,newsletter_priority,topic_tags,skill_tags,use_cases,related_project_ideas,category')
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('github_trends')
      .select('id,repo_full_name,short_summary,beginner_summary,description,newsletter_priority,topic_tags,skill_tags,topics,language,project_idea')
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('stars', { ascending: false })
      .limit(limit),
    supabase
      .from('research_papers')
      .select('id,title,beginner_summary,expert_summary,abstract,categories,related_skills,implementation_idea,service_idea,trend_score')
      .order('trend_score', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .limit(limit),
    supabase
      .from('trends')
      .select('id,keyword,summary,project_ideas,source_refs,score')
      .order('rank', { ascending: true })
      .limit(5),
  ]);

  const sources = buildSources({
    news: newsResult.data ?? [],
    products: productsResult.data ?? [],
    repos: reposResult.data ?? [],
    papers: papersResult.data ?? [],
    trends: trendsResult.data ?? [],
  }).slice(0, limit * 4);

  let upserted = 0;
  let errors = 0;
  let skipped = 0;

  for (const source of sources) {
    try {
      const { idea } = await generateProjectIdea({
        title: source.title,
        sourceType: source.sourceType,
        summary: source.summary,
        trend: source.trend,
        skills: source.skills,
      });

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
        console.error('Article draft project upsert failed', source.sourceType, source.title, error);
      } else {
        upserted += 1;
      }
    } catch (error) {
      errors += 1;
      console.error('Article draft generation failed', source.sourceType, source.title, error);
    }
  }

  if (!sources.length) skipped += 1;

  await recordIngestRun(supabase, {
    source: 'article-drafts',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { limit, sources: sources.length },
  });

  return NextResponse.json({ ok: true, upserted, skipped, errors, sources: sources.length });
}

function buildSources({
  news,
  products,
  repos,
  papers,
  trends,
}: {
  news: Array<Record<string, any>>;
  products: Array<Record<string, any>>;
  repos: Array<Record<string, any>>;
  papers: Array<Record<string, any>>;
  trends: Array<Record<string, any>>;
}): SourceItem[] {
  const trendBundle = trends.length
    ? [{
      sourceType: 'trend_bundle' as const,
      sourceId: trends[0].id as string,
      title: `이번 주 개발 트렌드 묶음: ${trends.map((item) => item.keyword).slice(0, 4).join(', ')}`,
      summary: trends.map((item) => `${item.keyword}: ${item.summary ?? '최근 감지된 개발 신호입니다.'}`).join('\n'),
      trend: trends[0].keyword as string | null,
      skills: trends.map((item) => item.keyword).filter(Boolean),
    }]
    : [];

  return [
    ...trendBundle,
    ...news.map((item) => ({
      sourceType: 'news' as const,
      sourceId: item.id as string,
      title: item.project_idea || item.title,
      summary: item.short_summary || item.beginner_summary || item.summary || item.title,
      trend: item.category ?? item.topic_tags?.[0] ?? null,
      skills: [...(item.skill_tags ?? []), ...(item.related_skills ?? [])],
    })),
    ...products.map((item) => ({
      sourceType: 'ai_product' as const,
      sourceId: item.id as string,
      title: item.related_project_ideas?.[0] || `${item.name} 참고 AI 제품 프로젝트`,
      summary: item.short_summary || item.description || item.name,
      trend: item.category ?? item.topic_tags?.[0] ?? null,
      skills: [...(item.skill_tags ?? []), ...(item.use_cases ?? [])],
    })),
    ...repos.map((item) => ({
      sourceType: 'github' as const,
      sourceId: item.id as string,
      title: item.project_idea || `${item.repo_full_name} 참고 오픈소스 프로젝트`,
      summary: item.short_summary || item.beginner_summary || item.description || item.repo_full_name,
      trend: item.language ?? item.topic_tags?.[0] ?? null,
      skills: [...(item.skill_tags ?? []), ...(item.topics ?? [])],
    })),
    ...papers.map((item) => ({
      sourceType: 'paper' as const,
      sourceId: item.id as string,
      title: item.implementation_idea || item.service_idea || `${item.title} 기반 구현 아이디어`,
      summary: item.beginner_summary || item.expert_summary || item.abstract || item.title,
      trend: item.categories?.[0] ?? null,
      skills: [...(item.related_skills ?? []), ...(item.categories ?? [])],
    })),
  ];
}
