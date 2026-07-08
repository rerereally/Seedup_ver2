import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ArrowRight, Bookmark, Calendar, Code2, FileText, Languages, Lightbulb, Search, Sparkles, TerminalSquare, TrendingUp } from 'lucide-react';
import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ScrapItem } from '@/lib/data';
import { getAIProducts, getGitHubTrends, getNewsItems, getProjectIdeas, getResearchPapers, getScraps, getTrends } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import OnboardingModal from '@/components/OnboardingModal';
import { cleanProjectTitle } from '@/lib/utils';
import { DevCard, DevSectionHeader, DevTag } from '@/components/ui/DevCard';

const STEPS = [
  { icon: Search, title: 'Article Collection', desc: '매일 최신 기술 뉴스와 글 수집' },
  { icon: Languages, title: 'Beginner Translation', desc: '초보자 눈높이로 쉬운 용어 해설' },
  { icon: TrendingUp, title: 'Trend Scoring', desc: '구현 가능성과 포트폴리오 가치 평가' },
  { icon: Lightbulb, title: 'Project Ideas', desc: '수준별 맞춤 프로젝트 도출' },
  { icon: Calendar, title: '7-Day Build Plan', desc: '작게 완성하는 실행 플랜 제공' },
];

const START_CARDS = [
  {
    icon: TrendingUp,
    title: '요즘 뭐가 뜨는지 알고 싶음',
    desc: '오늘의 개발 트렌드 보기',
    href: '/trends',
  },
  {
    icon: Code2,
    title: '뭘 만들어야 할지 모름',
    desc: '내 수준에 맞는 프로젝트 찾기',
    href: '/projects',
  },
  {
    icon: Lightbulb,
    title: '이미 아이디어가 있음',
    desc: '아이디어 평가받기',
    href: '/ideas',
  },
];

const SAVED_TYPE_LABELS: Record<string, string> = {
  news: '아티클',
  paper: '논문',
  github: '오픈소스',
  ai_product: 'AI 제품',
  project: '프로젝트',
  idea: '아이디어',
};

function scoreLabel(score: number | null | undefined) {
  if (!score) return '검증 중';
  return `${Math.round(score)}점`;
}

function articleSignal(item?: NewsItem) {
  const score = item?.relevance_score ? `${Math.round(item.relevance_score)} signal` : 'live signal';
  const views = item?.view_count ? `${item.view_count.toLocaleString()} views` : 'curated';
  return [score, views, item?.source].filter(Boolean).join(' / ');
}

function LoggedInHome({
  userName,
  popularNews,
  recommendedNews,
  githubRepos,
  projects,
  aiProducts,
  userScraps,
}: {
  userName: string;
  popularNews: NewsItem[];
  recommendedNews: NewsItem[];
  githubRepos: GitHubTrend[];
  projects: ProjectIdea[];
  aiProducts: AIProduct[];
  userScraps: ScrapItem[];
}) {
  const heroItem = popularNews[0] ?? recommendedNews[0];
  const topRepos = githubRepos.slice(0, 3);
  const todayProjects = projects.slice(0, 3);
  const topProducts = aiProducts.slice(0, 4);

  return (
    <main className="grow bg-surface">
      <section className="border-b border-ink bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-8 md:py-12">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 border border-ink bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
                <TerminalSquare className="h-3.5 w-3.5" />
                daily_dashboard.ts
              </div>
              <h1 className="text-3xl font-black leading-tight text-ink md:text-[44px]">
                {userName}님, 오늘 개발자들이 보는 신호만 골랐어요.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                인기 글, 추천 아티클, 뜨는 오픈소스, 오늘 도전할 프로젝트와 AI 제품 랭킹을 한 화면에 모았습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DevTag active>Live Briefing</DevTag>
              <DevTag>{recommendedNews.length} 추천</DevTag>
              <DevTag>{userScraps.length} 저장</DevTag>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Link href={heroItem ? `/news/${heroItem.id}` : '/news'} className="group border border-ink bg-ink p-6 text-white transition-opacity hover:opacity-95">
              <div className="mb-6 flex items-center justify-between gap-3 text-xs font-bold uppercase text-white/70">
                <span>지금 인기 있는 글</span>
                <span>{heroItem?.category ?? 'Article'}</span>
              </div>
              <h2 className="max-w-3xl text-2xl font-black leading-tight md:text-4xl">
                {heroItem?.title ?? '오늘 읽을 추천 글을 준비 중입니다.'}
              </h2>
              <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-6 text-white/70">
                {heroItem?.summary ?? '뉴스 수집이 완료되면 가장 반응이 좋은 아티클이 이 배너에 표시됩니다.'}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-4">
                <span className="text-xs font-bold uppercase text-white/60">{articleSignal(heroItem)}</span>
                <span className="inline-flex items-center gap-2 text-sm font-bold">
                  지금 읽기
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>

            <div className="grid gap-3 border border-outline-soft bg-white p-4">
              {[
                [`${popularNews.length}`, '실시간 인기'],
                [`${recommendedNews.length}`, '맞춤 추천'],
                [`${userScraps.length}`, '이어볼 저장'],
              ].map(([value, label]) => (
                <div key={label} className="flex items-center justify-between border border-outline-soft bg-surface px-4 py-3">
                  <span className="text-sm font-bold text-muted">{label}</span>
                  <span className="text-2xl font-black text-ink">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-outline-soft bg-surface py-12">
        <div className="mx-auto grid max-w-[1180px] gap-5 px-4 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-outline-soft bg-white p-5">
            <DevSectionHeader
              eyebrow="recommended_articles"
              title="오늘의 추천 아티클"
              action={<Link href="/news" className="text-xs font-bold uppercase text-ink hover:underline">전체 보기</Link>}
            />
            <div className="space-y-3">
              {recommendedNews.slice(0, 4).map((item) => (
                <Link key={item.id} href={`/news/${item.id}`} className="group grid gap-3 border border-outline-soft bg-surface-lowest p-4 hover:border-ink md:grid-cols-[120px_1fr]">
                  <div className="text-xs font-bold uppercase text-muted">{item.category ?? 'Article'}</div>
                  <div>
                    <h3 className="line-clamp-2 text-base font-black leading-snug text-ink group-hover:underline">{item.title}</h3>
                    {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.summary}</p>}
                  </div>
                </Link>
              ))}
              {!recommendedNews.length && <div className="border border-outline-soft bg-surface p-4 text-sm text-muted">추천 아티클을 준비 중입니다.</div>}
            </div>
          </div>

          <div className="border border-outline-soft bg-white p-5">
            <DevSectionHeader
              eyebrow="github_radar"
              title="뜨고 있는 GitHub 오픈소스"
              action={<Link href="/github-trends" className="text-xs font-bold uppercase text-ink hover:underline">전체 보기</Link>}
            />
            <div className="space-y-3">
              {topRepos.map((repo, index) => (
                <Link key={repo.id} href={`/github-trends/${repo.id}`} className="block border border-outline-soft bg-surface-lowest p-4 hover:border-ink">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <DevTag active>#{index + 1}</DevTag>
                    <span className="text-xs font-bold text-muted">{repo.stars?.toLocaleString() ?? 0} stars</span>
                  </div>
                  <h3 className="line-clamp-1 text-base font-black text-ink">{repo.repo_full_name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{repo.beginner_summary ?? repo.description ?? '학습과 프로젝트 참고 가치가 있는 저장소입니다.'}</p>
                </Link>
              ))}
              {!topRepos.length && <div className="border border-outline-soft bg-surface p-4 text-sm text-muted">오픈소스 데이터를 준비 중입니다.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-outline-soft bg-white py-12">
        <div className="mx-auto grid max-w-[1180px] gap-5 px-4 md:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border border-outline-soft bg-surface p-5">
            <DevSectionHeader
              eyebrow="today_build"
              title="오늘 도전해볼 프로젝트"
              action={<Link href="/projects" className="text-xs font-bold uppercase text-ink hover:underline">프로젝트 보기</Link>}
            />
            <div className="space-y-3">
              {todayProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block border border-outline-soft bg-white p-4 hover:border-ink">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <DevTag active>{project.level ?? '추천'}</DevTag>
                    {project.duration_days && <DevTag>{project.duration_days}일</DevTag>}
                  </div>
                  <h3 className="text-base font-black leading-snug text-ink">{cleanProjectTitle(project.title)}</h3>
                  {project.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{project.description}</p>}
                </Link>
              ))}
              {!todayProjects.length && <div className="border border-outline-soft bg-white p-4 text-sm text-muted">프로젝트 추천을 준비 중입니다.</div>}
            </div>
          </div>

          <div className="border border-outline-soft bg-surface p-5">
            <DevSectionHeader
              eyebrow="ai_tools_rank"
              title="요즘 많이 보는 AI 제품"
              action={<Link href="/ai-products" className="text-xs font-bold uppercase text-ink hover:underline">AI 제품 보기</Link>}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {topProducts.map((product, index) => (
                <Link key={product.id} href={`/ai-products/${product.id}`} className="border border-outline-soft bg-white p-4 hover:border-ink">
                  <div className="mb-3 flex items-center justify-between">
                    <DevTag active>#{index + 1}</DevTag>
                    <span className="text-xs font-bold uppercase text-muted">{scoreLabel(product.score)}</span>
                  </div>
                  <h3 className="line-clamp-1 text-base font-black text-ink">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{product.description ?? product.target_user ?? '개발 워크플로우에 붙여볼 만한 AI 제품입니다.'}</p>
                </Link>
              ))}
              {!topProducts.length && <div className="border border-outline-soft bg-white p-4 text-sm text-muted sm:col-span-2">AI 제품 랭킹을 준비 중입니다.</div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const userResult = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = userResult.data.user;

  if (user) {
    const [news, projects, githubRepos, aiProducts, userScraps] = await Promise.all([
      getNewsItems(),
      getProjectIdeas(),
      getGitHubTrends(),
      getAIProducts(),
      getScraps(),
    ]);
    const popularNews = [...news].sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0)).slice(0, 4);
    const userName = user.email?.split('@')[0] ?? '개발자';
    let recommendedNews = popularNews;
    let shouldShowOnboarding = false;

    if (supabase) {
      const { data } = await supabase
        .from('user_onboarding')
        .select('id,answers')
        .eq('user_id', user.id)
        .maybeSingle();

      shouldShowOnboarding = !data;
      const answerValues = Object.values((data?.answers ?? {}) as Record<string, string | string[]>).flat().map((value) => String(value).toLowerCase());
      const personalized = news
        .map((item) => {
          const text = [item.title, item.summary, item.category, item.beginner_summary, ...(item.related_skills ?? [])].join(' ').toLowerCase();
          const score = answerValues.filter((value) => value && text.includes(value)).length + Number(item.relevance_score ?? 0) / 100;
          return { item, score };
        })
        .filter(({ score }) => score > 0.4)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
        .slice(0, 4);
      recommendedNews = personalized.length ? personalized : popularNews;
    }

    return (
      <>
        {shouldShowOnboarding && <OnboardingModal userId={user.id} email={user.email ?? null} />}
        <Header />
        <LoggedInHome
          userName={userName}
          popularNews={popularNews}
          recommendedNews={recommendedNews}
          githubRepos={githubRepos}
          projects={projects}
          aiProducts={aiProducts}
          userScraps={userScraps}
        />
        <Footer />
      </>
    );
  }

  const [news, trends, projects, researchPapers] = await Promise.all([
    getNewsItems(),
    getTrends(),
    getProjectIdeas(),
    getResearchPapers(6),
  ]);
  const latestNews = news[0];
  const topTrend = trends[0];
  const latestProject = projects[0];
  const popularNews = [...news].sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0)).slice(0, 4);

  return (
    <>
      <Header />
      <main className="grow overflow-hidden">
        <section className="relative border-b border-ink bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14 lg:py-16">
            <div className="mb-9 flex flex-col gap-3 border-b border-outline-soft pb-5 md:flex-row md:items-center md:justify-between">
              <div className="inline-flex w-fit items-center gap-2 border border-ink bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
                <TerminalSquare className="h-3.5 w-3.5" />
                what_is_seedup.ts
              </div>
              <div className="flex flex-wrap gap-2">
                <DevTag active>Developer Newsletter</DevTag>
                <DevTag>AI / OSS / Papers</DevTag>
              </div>
            </div>

            <div className="grid items-center gap-10 lg:grid-cols-3">
              <div className="lg:col-span-2">
              <h1 className="max-w-2xl text-balance text-4xl font-black leading-tight text-ink md:text-6xl">
                개발자가 매일 봐야 할 기술 흐름을 한 번에 정리합니다
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
                Seedup은 AI 뉴스, 오픈소스 저장소, 논문, 개발 트렌드를 한국어로 요약하고 “읽고 끝”이 아니라 프로젝트 아이디어까지 연결해주는 개발자용 뉴스레터 서비스입니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex h-12 items-center gap-2 bg-ink px-6 text-sm font-bold text-white transition-opacity hover:opacity-90">
                  무료로 시작하기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/trends" className="inline-flex h-12 items-center border border-outline-soft bg-white px-6 text-sm font-bold text-ink transition-colors hover:border-ink">
                  서비스 둘러보기
                </Link>
              </div>

              <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
                {START_CARDS.map((card) => (
                  <DevCard key={card.href} as={Link} href={card.href} className="p-4">
                    <card.icon className="mb-4 h-5 w-5 text-ink" />
                    <h2 className="text-sm font-black leading-5 text-ink">{card.title}</h2>
                    <p className="mt-2 text-xs font-semibold leading-5 text-muted">{card.desc}</p>
                  </DevCard>
                ))}
              </div>

              <div className="mt-9 grid max-w-2xl grid-cols-3 border-y border-outline-soft py-5">
                {[
                  [`${trends.length}개`, '트렌드 분석 중'],
                  [`${projects.length}개`, '프로젝트 아이디어'],
                  [`${news.length}개`, '아티클 수집됨'],
                ].map(([value, label], index) => (
                  <div key={label} className={index === 0 ? '' : 'border-l border-outline-soft/70 pl-5'}>
                    <div className="text-3xl font-black text-ink">{value}</div>
                    <div className="mt-1 text-xs font-bold uppercase text-muted">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto w-full max-w-sm lg:mx-0">
              <div className="border border-outline-soft bg-surface p-4">
                <div className="relative border border-ink bg-white p-4 shadow-[7px_7px_0_#0a0a0a]">
                  <div className="mb-4 flex items-center justify-between border-b border-outline-soft pb-3 text-[10px] font-bold uppercase text-muted">
                    <span>DATA_STREAM</span>
                    <span>V.1.0.4</span>
                  </div>
                  <div className="space-y-2">
                    <div className="stream-bar h-2 w-[74%] bg-surface-high" />
                    <div className="stream-bar stream-bar-delay-1 h-2 w-[50%] bg-surface-high" />
                    <div className="stream-bar stream-bar-delay-2 h-2 w-[82%] bg-ink" />
                    <div className="stream-bar stream-bar-delay-3 h-2 w-full bg-surface-high" />
                  </div>
                  <div className="mt-16 min-h-[160px] border-l border-outline-soft pl-4 text-sm leading-7 text-ink md:min-h-[220px]">
                    <div className="typing-line">collecting_ai_news()</div>
                    <div className="mt-3 text-muted">summarize.kr()</div>
                    <div className="text-muted">rank_open_source()</div>
                    <div className="text-muted">generate_project_idea()</div>
                  </div>
                  <div className="mt-8 inline-flex bg-ink px-3 py-2 text-xs font-bold uppercase text-white">
                    PROCESSING...
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="border-b border-outline-soft bg-white py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 md:px-8 lg:grid-cols-5">
            <div className="border border-outline-soft bg-surface p-5 md:p-6 lg:col-span-3">
              <DevSectionHeader
                eyebrow="weekly_popular"
                title="이번 주 인기 글"
                action={<Link href="/news?tab=popular" className="text-xs font-bold uppercase text-ink hover:underline">전체 보기</Link>}
              />
              <div className="grid gap-3 md:grid-cols-2">
                {popularNews.map((item, index) => (
                  <Link key={item.id} href={`/news/${item.id}`} className="group border border-outline-soft bg-white p-4 transition-colors hover:border-ink">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <DevTag active>#{index + 1}</DevTag>
                      <span className="text-xs font-bold uppercase text-muted">{item.category ?? 'Article'}</span>
                    </div>
                    <h3 className="line-clamp-2 text-lg font-black leading-snug text-ink group-hover:underline">{item.title}</h3>
                    {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.summary}</p>}
                  </Link>
                ))}
                {!popularNews.length && (
                  <div className="border border-outline-soft bg-white p-4 text-sm leading-6 text-muted md:col-span-2">
                    RSS 수집을 실행하면 이번 주 인기 글이 표시됩니다.
                  </div>
                )}
              </div>
            </div>

            <div className="border border-outline-soft bg-surface p-5 md:p-6 lg:col-span-2">
              <DevSectionHeader
                eyebrow="service_overview"
                title="Seedup은 이런 서비스입니다"
                description="개발자가 매일 쏟아지는 기술 정보를 놓치지 않도록 수집, 요약, 해석, 실행 아이디어까지 이어줍니다."
              />
              <div className="space-y-3">
                {[
                  ['01', '기술 정보 수집', 'AI, 오픈소스, 논문, 개발 트렌드를 한 곳에 모읍니다.'],
                  ['02', '한국어 요약', '초보자도 맥락을 이해할 수 있게 쉬운 설명으로 바꿉니다.'],
                  ['03', '실행으로 연결', '읽은 내용을 만들 수 있는 프로젝트 아이디어와 학습 방향으로 정리합니다.'],
                ].map(([step, title, desc]) => (
                      <div key={step} className="grid grid-cols-[2.75rem_1fr] gap-4 border border-outline-soft bg-white p-4">
                    <div className="flex h-9 w-9 items-center justify-center bg-ink text-xs font-black text-white">{step}</div>
                    <div>
                      <h3 className="text-sm font-black text-ink">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-outline-soft bg-surface py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 md:px-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted">
                <Lightbulb className="h-4 w-4" />
                idea_evaluation
              </div>
              <h2 className="text-3xl font-black leading-tight text-ink">만들고 싶은 아이디어가 있나요?</h2>
              <p className="mt-3 max-w-xl leading-7 text-muted">
                한 문장으로 적으면 타깃 사용자, 핵심 기능, 난이도, 추천 기술 스택, 7일 실행 방향으로 이어서 정리해드립니다.
              </p>
            </div>
            <div className="border border-outline-soft bg-white p-5">
              <div className="border border-outline-soft bg-surface-lowest p-4">
                <div className="mb-3 text-xs font-bold uppercase text-muted">input_preview</div>
                <div className="min-h-24 border border-outline-soft bg-white p-4 text-sm leading-7 text-ink">
                  <span className="typing-line">AI로 개발 뉴스를 요약해서 슬랙으로 보내주는 봇</span>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  ['가치', '팀 지식 공유 자동화'],
                  ['스택', 'Next.js / Slack API'],
                  ['플랜', '7일 MVP 빌드'],
                ].map(([label, value]) => (
                  <div key={label} className="border border-outline-soft bg-surface p-3">
                    <div className="text-xs font-bold uppercase text-muted">{label}</div>
                    <div className="mt-2 text-sm font-black leading-5 text-ink">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-soft pt-4">
                <div className="flex flex-wrap gap-2">
                  <DevTag>Demo Output</DevTag>
                  <DevTag>Login Required</DevTag>
                </div>
                <Link href="/login" className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-sm font-bold text-white transition-opacity hover:opacity-90">
                  로그인하고 평가받기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {!!researchPapers.length && (
          <section className="border-b border-outline-soft bg-surface py-16">
            <div className="mx-auto max-w-6xl px-4 md:px-8">
              <DevSectionHeader
                eyebrow="research_brief"
                title="이번 주 집중해야 할 논문"
                description="원문 대신 한국어 요약과 구현 아이디어를 먼저 확인하세요."
                action={<Link href="/news" className="text-xs font-bold uppercase text-ink hover:underline">아티클에서 보기</Link>}
              />
              <div className="grid gap-4 md:grid-cols-3">
                {researchPapers.slice(0, 3).map((paper) => (
                  <article key={paper.id} className="border border-outline-soft bg-white p-5">
                    <div className="mb-3"><DevTag>{paper.review_type ?? '논문 리뷰'}</DevTag></div>
                    <h3 className="line-clamp-2 text-lg font-black leading-snug text-ink">{paper.title}</h3>
                    {paper.beginner_summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{paper.beginner_summary}</p>}
                    {paper.paper_url && (
                      <Link href={paper.paper_url} target="_blank" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline">
                        원문 보기
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="border-b border-outline-soft bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <DevSectionHeader
              eyebrow="pipeline"
              title="How it works"
              description="복잡한 기술 뉴스가 당신의 포트폴리오로 변하는 과정"
            />
            <div className="grid gap-4 md:grid-cols-5">
              {STEPS.map((step, index) => (
                <div key={step.title} className="border border-outline-soft bg-surface p-5">
                  <div className={`mb-6 flex h-12 w-12 items-center justify-center border ${index === STEPS.length - 1 ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-white text-ink'}`}>
                    <step.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-black text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
