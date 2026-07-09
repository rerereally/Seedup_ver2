import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzeRepo } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { GITHUB_QUERIES } from '@/lib/ingest/sources';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GITHUB_FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_MIN_GITHUB_STARS = 50;
const DEFAULT_PUSHED_WINDOW_DAYS = 30;

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
  const perQuery = Math.min(30, Number(url.searchParams.get('limit') ?? 15));
  const minStars = Math.max(1, Number(url.searchParams.get('minStars') ?? process.env.GITHUB_MIN_STARS ?? DEFAULT_MIN_GITHUB_STARS));
  const pushedAfter = url.searchParams.get('pushedAfter') ?? getDaysAgo(DEFAULT_PUSHED_WINDOW_DAYS);
  const pruneDays = Number(url.searchParams.get('pruneDays') ?? 30);
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    accept: 'application/vnd.github+json',
    'user-agent': 'SeedupBot/1.0',
  };

  if (token) headers.authorization = `Bearer ${token}`;

  let upserted = 0;
  let errors = 0;
  let skipped = 0;
  let pruned = 0;
  const seen = new Set<string>();

  for (const query of GITHUB_QUERIES) {
    const search = `${query} pushed:>${pushedAfter}`;
    // sort=updated: 최근 push/commit이 많은 저장소 우선 → 급부상 중인 신규 프로젝트 수집
    const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(search)}&sort=updated&order=desc&per_page=${perQuery}`;

    try {
      const json = await fetchGitHubJson(apiUrl, headers);

      for (const repo of json.items ?? []) {
        if (seen.has(repo.full_name)) {
          skipped += 1;
          continue;
        }
        seen.add(repo.full_name);

        const preflight = evaluateGitHubRepoPreflight(repo, minStars);
        if (!preflight.ok) {
          skipped += 1;
          continue;
        }

        const topics = Array.isArray(repo.topics) ? repo.topics : [];
        const { analysis } = await analyzeRepo({
          fullName: repo.full_name,
          description: repo.description,
          language: repo.language,
          topics,
        });
        if (!isRepoAnalysisUsable(analysis)) {
          skipped += 1;
          continue;
        }
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
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

        const { error } = await upsertGitHubTrend(supabase, payload);

        if (error) {
          errors += 1;
          console.error('GitHub trend upsert failed', repo.full_name, error);
        } else {
          upserted += 1;
          await recordGitHubStarSnapshot(supabase, {
            repoFullName: repo.full_name,
            stars: Number(repo.stargazers_count ?? 0),
            forks: Number(repo.forks_count ?? 0),
            pushedAt: repo.pushed_at ?? null,
          });
        }
      }
    } catch (error) {
      errors += 1;
      console.error('GitHub query failed', query, error);
    }
  }

  try {
    pruned = await pruneStaleGitHubRepos(supabase, pruneDays);
  } catch (error) {
    errors += 1;
    console.error('GitHub stale prune failed', error);
  }

  await recordIngestRun(supabase, {
    source: 'github',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { perQuery, minStars, pushedAfter, pruneDays, pruned, queries: GITHUB_QUERIES.length },
  });

  return NextResponse.json({ ok: true, upserted, skipped, pruned, errors, pushedAfter, minStars });
}

async function fetchGitHubJson(url: string, headers: HeadersInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GITHUB_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
      return await response.json() as { items?: Array<Record<string, any>> };
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function evaluateGitHubRepoPreflight(repo: Record<string, any>, minStars: number) {
  const fullName = String(repo.full_name ?? '');
  const description = String(repo.description ?? '').trim();
  const topics = Array.isArray(repo.topics) ? repo.topics.map(String) : [];
  const text = [fullName, description, repo.language, ...topics].join(' ').toLowerCase();
  const stars = Number(repo.stargazers_count ?? 0);
  const pushedAt = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
  const pushedAgeDays = pushedAt ? (Date.now() - pushedAt) / (24 * 60 * 60 * 1000) : 999;

  if (repo.archived || repo.disabled || repo.fork) return { ok: false, reason: 'inactive_or_fork' };
  if (stars < minStars) return { ok: false, reason: 'low_stars' };
  if (pushedAgeDays > 45) return { ok: false, reason: 'stale_push' };
  if (description.length < 24) return { ok: false, reason: 'thin_description' };
  if (/(^|[\/\s-])(awesome|list|lists|collection|curated|tutorial|examples?|leetcode|algorithm-study)([\/\s-]|$)/i.test(text) && stars < 500) {
    return { ok: false, reason: 'low_signal_collection' };
  }

  const hasSeedupSignal = [
    /ai[-\s]?agent|llm[-\s]?agent|agentic|coding agent|code agent/,
    /\bmcp\b|model context protocol|rag|retrieval|vector database/,
    /ai coding|codegen|developer tool|devtool|cli|sdk|ide|workflow|automation|observability/,
    /local llm|ollama|langgraph|vercel ai sdk|supabase|next\.?js|react/,
    /template|starter|boilerplate|framework|toolkit|dashboard/,
  ].some((pattern) => pattern.test(text));

  if (!hasSeedupSignal) return { ok: false, reason: 'off_topic' };
  return { ok: true };
}

function isRepoAnalysisUsable(analysis: Awaited<ReturnType<typeof analyzeRepo>>['analysis']) {
  const combined = [analysis.ai_review, analysis.beginner_summary, analysis.project_idea].join('\n');
  if (Number(analysis.relevance_score ?? 0) < 65) return false;
  if (!/[가-힣]/.test(combined)) return false;
  if (/이 저장소를 활용하여|이 저장소처럼|핵심 기능 만들어보기|프로젝트 설명이 제공되지 않았습니다/i.test(combined)) return false;
  if ((analysis.ai_review?.length ?? 0) < 50 || (analysis.beginner_summary?.length ?? 0) < 50) return false;
  return true;
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
    'last_seen_at',
    'stars_delta_7d',
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
    'last_seen_at',
    'stars_delta_7d',
  ]) {
    delete fallbackPayload[key];
  }

  console.warn('GitHub trend upsert retrying without newsletter metadata columns. Apply supabase/schema.sql to enable full metadata.');
  return supabase.from('github_trends').upsert(fallbackPayload, { onConflict: 'repo_full_name' });
}

async function recordGitHubStarSnapshot(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  input: { repoFullName: string; stars: number; forks: number; pushedAt: string | null },
) {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = getDaysAgo(7);
  const snapshot = await supabase
    .from('github_repo_snapshots')
    .upsert(
      {
        repo_full_name: input.repoFullName,
        snapshot_date: today,
        stars: input.stars,
        forks: input.forks,
        pushed_at: input.pushedAt,
      },
      { onConflict: 'repo_full_name,snapshot_date' },
    );

  if (snapshot.error) {
    const message = snapshot.error.message.toLowerCase();
    if (message.includes('schema') || message.includes('github_repo_snapshots') || message.includes('column')) return;
    console.error('GitHub star snapshot failed', input.repoFullName, snapshot.error);
    return;
  }

  const { data } = await supabase
    .from('github_repo_snapshots')
    .select('stars')
    .eq('repo_full_name', input.repoFullName)
    .lte('snapshot_date', sevenDaysAgo)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousStars = Number(data?.stars ?? input.stars);
  await supabase
    .from('github_trends')
    .update({ stars_delta_7d: input.stars - previousStars, last_seen_at: new Date().toISOString() })
    .eq('repo_full_name', input.repoFullName);
}

async function pruneStaleGitHubRepos(supabase: NonNullable<ReturnType<typeof createAdminClient>>, pruneDays: number) {
  const cutoff = getDaysAgo(Math.max(14, pruneDays));
  const stale = await supabase
    .from('github_trends')
    .delete()
    .lt('last_seen_at', cutoff)
    .lt('pushed_at', cutoff)
    .select('id');

  if (stale.error) {
    const message = stale.error.message.toLowerCase();
    if (message.includes('last_seen_at') || message.includes('schema') || message.includes('column')) return 0;
    throw stale.error;
  }

  return stale.data?.length ?? 0;
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
