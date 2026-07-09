import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzeRepo } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { GITHUB_QUERIES } from '@/lib/ingest/sources';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
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
  const perQuery = Number(url.searchParams.get('limit') ?? 5);
  const pushedAfter = url.searchParams.get('pushedAfter') ?? getDaysAgo(7);
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    accept: 'application/vnd.github+json',
    'user-agent': 'SeedupBot/1.0',
  };

  if (token) headers.authorization = `Bearer ${token}`;

  let upserted = 0;
  let errors = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of GITHUB_QUERIES) {
    const search = `${query} pushed:>${pushedAfter}`;
    // sort=updated: 최근 push/commit이 많은 저장소 우선 → 급부상 중인 신규 프로젝트 수집
    const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(search)}&sort=updated&order=desc&per_page=${perQuery}`;

    try {
      const response = await fetch(apiUrl, { headers });
      if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
      const json = await response.json();

      for (const repo of json.items ?? []) {
        if (seen.has(repo.full_name)) {
          skipped += 1;
          continue;
        }
        seen.add(repo.full_name);

        const topics = Array.isArray(repo.topics) ? repo.topics : [];
        const { analysis } = await analyzeRepo({
          fullName: repo.full_name,
          description: repo.description,
          language: repo.language,
          topics,
        });
        const metadata = buildRepoNewsletterMetadata({
          analysis,
          language: repo.language,
          topics,
          stars: repo.stargazers_count,
          description: repo.description,
        });

        const payload = {
            repo_full_name: repo.full_name,
            repo_url: repo.html_url,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            topics,
            pushed_at: repo.pushed_at,
            ...metadata,
            ai_review: analysis.ai_review,
            beginner_summary: analysis.beginner_summary,
            project_idea: analysis.project_idea,
            relevance_score: analysis.relevance_score,
            updated_at: new Date().toISOString(),
          };

        const { error } = await upsertGitHubTrend(supabase, payload);

        if (error) {
          errors += 1;
          console.error('GitHub trend upsert failed', repo.full_name, error);
        } else {
          upserted += 1;
        }
      }
    } catch (error) {
      errors += 1;
      console.error('GitHub query failed', query, error);
    }
  }

  await recordIngestRun(supabase, {
    source: 'github',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { perQuery, pushedAfter, queries: GITHUB_QUERIES },
  });

  return NextResponse.json({ ok: true, upserted, skipped, errors, pushedAfter });
}

async function upsertGitHubTrend(supabase: NonNullable<ReturnType<typeof createAdminClient>>, payload: Record<string, unknown>) {
  const result = await supabase.from('github_trends').upsert(payload, { onConflict: 'repo_full_name' });
  if (!result.error) return result;

  const message = result.error.message.toLowerCase();
  const metadataColumnError = [
    'content_type',
    'newsletter_section',
    'newsletter_priority',
    'short_summary',
    'topic_tags',
    'skill_tags',
    'intent_tags',
    'audience_tags',
    'related_roles',
    'learning_topics',
    'project_convertible',
    'personalization_hooks',
    'source_quality_score',
    'novelty_score',
    'buildability_score',
    'project_connect_score',
    'recommendation_reasons',
  ].some((column) => message.includes(column));

  if (!metadataColumnError) return result;

  const fallbackPayload = { ...payload };
  for (const key of [
    'content_type',
    'newsletter_section',
    'newsletter_priority',
    'short_summary',
    'topic_tags',
    'skill_tags',
    'intent_tags',
    'audience_tags',
    'related_roles',
    'learning_topics',
    'project_convertible',
    'personalization_hooks',
    'source_quality_score',
    'novelty_score',
    'buildability_score',
    'project_connect_score',
    'recommendation_reasons',
  ]) {
    delete fallbackPayload[key];
  }

  console.warn('GitHub trend upsert retrying without newsletter metadata columns. Apply supabase/schema.sql to enable full metadata.');
  return supabase.from('github_trends').upsert(fallbackPayload, { onConflict: 'repo_full_name' });
}

function buildRepoNewsletterMetadata({
  analysis,
  language,
  topics,
  stars,
  description,
}: {
  analysis: Awaited<ReturnType<typeof analyzeRepo>>['analysis'];
  language: string | null;
  topics: string[];
  stars: number;
  description: string | null;
}) {
  const projectConvertible = Boolean(analysis.project_idea);
  const popularity = Math.min(95, Math.round(Math.log10(Number(stars ?? 0) + 1) * 20));
  const priority = Math.max(popularity, Number(analysis.relevance_score ?? 60));
  const skills = [language, ...topics].filter(Boolean) as string[];

  return {
    content_type: 'github_repo',
    newsletter_section: 'github_project_pick',
    newsletter_priority: priority,
    short_summary: analysis.beginner_summary || description || '프로젝트 참고 가치가 있는 오픈소스 저장소입니다.',
    topic_tags: topics,
    skill_tags: skills,
    intent_tags: projectConvertible ? ['프로젝트 연결 가능', '포트폴리오 추천'] : ['오픈소스 학습'],
    audience_tags: ['개발자'],
    related_roles: inferRoles(skills),
    learning_topics: skills,
    project_convertible: projectConvertible,
    personalization_hooks: projectConvertible ? [analysis.project_idea] : [],
    source_quality_score: 70,
    novelty_score: 62,
    buildability_score: projectConvertible ? 74 : 58,
    project_connect_score: projectConvertible ? 76 : 55,
    recommendation_reasons: projectConvertible ? ['오픈소스를 미니 프로젝트로 확장 가능'] : ['오픈소스 학습에 적합'],
  };
}

function inferRoles(values: string[]) {
  const text = values.join(' ').toLowerCase();
  const roles = new Set<string>();
  if (/front|react|next|ui|ux|프론트|디자인/.test(text)) roles.add('frontend_developer');
  if (/back|api|db|server|node|postgres|supabase|백엔드/.test(text)) roles.add('backend_developer');
  if (/ai|llm|agent|model|rag|mcp|인공지능/.test(text)) roles.add('ai_builder');
  if (/startup|product|saas|창업|제품|사이드/.test(text)) roles.add('startup_builder');
  if (!roles.size) roles.add('developer');
  return [...roles];
}

function getDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
