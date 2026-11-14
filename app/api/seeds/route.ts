import { getGitHubTrends, getNewsItems } from '@/lib/data';
import { getOpportunities, getOpportunityEmbeddings } from '@/lib/opportunities/data';
import { matchLinks, nearOpportunities, repoSimilarity, searchPapers, suggestIdeas } from '@/lib/seeds/advise';
import type { Linkable, SeedIdea, SeedPaper } from '@/lib/seeds/advise';
import { fetchPublicRepos, GitHubLookupError, isGitHubLogin } from '@/lib/seeds/github';
import type { GitHubLookupFailure, SeedRepo } from '@/lib/seeds/github';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const CACHE_MS = 10 * 60_000;
const DAILY_IDEA_LIMIT = 30;
const MAX_CACHED = 200;
// Per-instance, best effort. Each step costs a different shared quota, so each has its own budget.
const LIMITS = { repos: 8, ideas: 12, papers: 12 } as const;

const repoCache = new Map<string, { at: number; repos: SeedRepo[] }>();
const ideaCache = new Map<string, SeedIdea>();
const paperCache = new Map<string, SeedPaper[]>();
const recent = new Map<string, number[]>();

const LOOKUP_MESSAGES: Record<GitHubLookupFailure, [string, number]> = {
  not_found: ['그 아이디의 GitHub 계정을 찾지 못했습니다.', 404],
  rate_limited: ['GitHub 조회 한도에 걸렸습니다. 잠시 뒤에 다시 시도해 주세요.', 429],
  unavailable: ['GitHub에서 레포를 읽지 못했습니다. 잠시 뒤에 다시 시도해 주세요.', 502],
};

function isThrottled(client: string, step: keyof typeof LIMITS) {
  const key = `${step}:${client}`;
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((time) => now - time < 60_000);
  if (times.length >= LIMITS[step]) return true;
  times.push(now);
  recent.set(key, times);
  if (recent.size > 2_000) recent.clear();
  return false;
}

function remember<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(key, value);
}

async function loadRepos(login: string) {
  const cached = repoCache.get(login);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.repos;
  const repos = await fetchPublicRepos(login);
  remember(repoCache, login, { at: Date.now(), repos });
  return repos;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const step = params.get('step') ?? 'repos';
  const client = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const tooMany = () => NextResponse.json({ error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' }, { status: 429 });

  if (step === 'papers') {
    const query = (params.get('q') ?? '').toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (query.length < 3) return NextResponse.json({ papers: [] });
    const cached = paperCache.get(query);
    if (cached) return NextResponse.json({ papers: cached });
    if (isThrottled(client, 'papers')) return tooMany();
    const papers = await searchPapers(query);
    if (papers.length) remember(paperCache, query, papers);
    return NextResponse.json({ papers });
  }

  const login = (params.get('user') ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!isGitHubLogin(login)) return NextResponse.json({ error: 'GitHub 아이디를 확인해 주세요. 영문, 숫자, 하이픈만 쓸 수 있습니다.' }, { status: 400 });

  if (step === 'ideas') {
    // One repo per request, so a slow answer for one never holds back the others.
    const repoName = (params.get('repo') ?? '').slice(0, 100);
    const cacheKey = `${login}/${repoName}`;
    const cached = ideaCache.get(cacheKey);
    if (cached) return NextResponse.json({ idea: cached });
    // The model quota is shared by every feature, so only signed-in users may spend it, within a daily limit.
    const supabase = await createClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (!supabase || !data.user) return NextResponse.json({ idea: null, error: '로그인 후 AI 기능 제안을 볼 수 있습니다.' }, { status: 401 });
    if (isThrottled(client, 'ideas')) return tooMany();
    if (!(await consumeDailyUsage(supabase, 'seed_ideas', DAILY_IDEA_LIMIT))) {
      return NextResponse.json({ idea: null, error: `AI 기능 제안은 하루 ${DAILY_IDEA_LIMIT}개 레포까지 볼 수 있습니다.` }, { status: 429 });
    }
    let idea: SeedIdea | null = null;
    try {
      const [repos, { opportunities }] = await Promise.all([loadRepos(login), getOpportunities()]);
      const repo = repos.find((item) => item.name === repoName);
      idea = repo ? (await suggestIdeas([repo], opportunities))?.[repo.name] ?? null : null;
    } catch {
      idea = null;
    }
    if (idea) remember(ideaCache, cacheKey, idea);
    else await releaseDailyUsage(supabase, 'seed_ideas');
    // The page keeps its keyword matches when this is null, so a silent model is not an error.
    return NextResponse.json({ idea });
  }

  if (!repoCache.has(login) && isThrottled(client, 'repos')) return tooMany();
  let repos: SeedRepo[];
  try {
    repos = await loadRepos(login);
  } catch (error) {
    const [message, status] = LOOKUP_MESSAGES[error instanceof GitHubLookupError ? error.reason : 'unavailable'];
    return NextResponse.json({ error: message }, { status });
  }

  const [{ opportunities }, embeddings, news, trends] = await Promise.all([
    getOpportunities(),
    getOpportunityEmbeddings().catch(() => ({})),
    getNewsItems().catch(() => []),
    getGitHubTrends().catch(() => []),
  ]);
  const newsLinks: Linkable[] = news.flatMap((item) => {
    const hasBody = Boolean(item.content?.trim());
    const outside = item.original_url ?? item.source_url ?? '';
    if (!hasBody && !outside.startsWith('https://')) return [];
    return [{ title: item.title, href: hasBody ? `/news/${item.id}` : outside, meta: item.source ?? '', external: !hasBody, text: [item.title, item.category ?? '', ...(item.topic_tags ?? []), ...(item.skill_tags ?? [])].join(' ') }];
  });
  const own = new Set(repos.map((repo) => repo.fullName.toLowerCase()));
  const trendLinks: Linkable[] = trends.filter((item) => !own.has(item.repo_full_name.toLowerCase())).map((item) => ({
    title: item.repo_full_name,
    href: `/github-trends/${item.id}`,
    meta: `★ ${(item.stars ?? 0).toLocaleString('en-US')}`,
    external: false,
    text: [item.repo_full_name, item.description ?? '', item.language ?? '', ...(item.topics ?? [])].join(' '),
  }));
  const similarities = await Promise.all(repos.map((repo) => repoSimilarity(repo, embeddings)));

  return NextResponse.json({
    login,
    repos: repos.map((repo, index) => ({
      name: repo.name,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      topics: repo.topics.slice(0, 6),
      stars: repo.stars,
      pushedAt: repo.pushedAt,
      near: nearOpportunities(repo, opportunities, similarities[index]),
      news: matchLinks(repo, newsLinks),
      similar: matchLinks(repo, trendLinks, 2),
    })),
  });
}
