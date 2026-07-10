import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ArrowRight, Calendar, Code2, Languages, Lightbulb, Search, TerminalSquare, TrendingUp } from 'lucide-react';
import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ScrapItem } from '@/lib/data';
import { getAIProducts, getGitHubTrends, getNewsItems, getProjectIdeas, getResearchPapers, getScraps, getTrends } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import OnboardingModal from '@/components/OnboardingModal';
import { cleanProjectTitle } from '@/lib/utils';
import { DevCard, DevSectionHeader, DevTag } from '@/components/ui/DevCard';
import DashboardRecommendationBanner from '@/components/DashboardRecommendationBanner';
import { buildRecommendationProfile, recommendAIProducts, recommendGitHubRepos, recommendNewsItems, recommendProjectIdeas, scrapTokens, type RecommendedItem } from '@/lib/recommendations';

const STEPS = [
  { icon: Search, title: 'Data Collection', desc: '뉴스, 제품, GitHub, 논문 신호 수집' },
  { icon: Languages, title: 'Metadata Preprocess', desc: '태그, 직무, 난이도, 목표 분석' },
  { icon: TrendingUp, title: 'Personal Match', desc: '프로필과 콘텐츠 점수 매칭' },
  { icon: Lightbulb, title: 'Newsletter Assembly', desc: '섹션별 맞춤 브리핑 구성' },
  { icon: Calendar, title: 'Writing On Demand', desc: '필요한 항목만 긴 글과 빌드 아이디어 생성' },
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

function LoggedInHome({
  userName,
  recommendedNews,
  latestNews,
  githubRepos,
  projects,
  aiProducts,
  userScraps,
}: {
  userName: string;
  recommendedNews: RecommendedItem<NewsItem>[];
  latestNews: NewsItem[];
  githubRepos: RecommendedItem<GitHubTrend>[];
  projects: RecommendedItem<ProjectIdea>[];
  aiProducts: RecommendedItem<AIProduct>[];
  userScraps: ScrapItem[];
}) {
  const topRepos = githubRepos.slice(0, 3);
  const todayProjects = projects.slice(0, 3);
  const topProducts = aiProducts.slice(0, 4);

  return (
    <main className="grow bg-surface">
      <section className="border-b border-ink bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-6">
          {/* 상단: 타이틀 + 배지 */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 border border-ink bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
                <TerminalSquare className="h-3.5 w-3.5" />
                daily_dashboard.ts
              </div>
              <h1 className="text-3xl font-black leading-tight text-ink md:text-5xl">
                {userName}님, 오늘 볼 기술 신호입니다.
              </h1>
              <p className="mt-1.5 max-w-3xl text-base leading-7 text-muted">
                인기 아티클, 오픈소스, 프로젝트 후보, AI 제품을 빠르게 훑고 바로 이어갈 수 있게 정리했습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DevTag active>Daily Briefing</DevTag>
              <DevTag>{recommendedNews.length} 추천</DevTag>
              <DevTag>{userScraps.length} 저장</DevTag>
            </div>
          </div>

          {/* 하단: 배너 — 내용 크기에 맞게 자연스럽게 높이 결정 */}
          <DashboardRecommendationBanner recommendedNews={recommendedNews} latestNews={latestNews} />
        </div>
      </section>

      <section className="border-b border-outline-soft bg-surface py-12">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 md:px-8 lg:grid-cols-2">
          <div className="border border-outline-soft bg-white p-5">
            <DevSectionHeader
              eyebrow="github_radar"
              title="뜨고 있는 GitHub 오픈소스"
              action={<Link href="/github-trends" className="text-xs font-bold uppercase text-ink hover:underline">전체 보기</Link>}
            />
            <div className="space-y-3">
              {topRepos.map(({ item: repo, reasons }, index) => (
                <Link key={repo.id} href={`/github-trends/${repo.id}`} className="block border border-outline-soft bg-surface-lowest p-4 hover:border-ink">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <DevTag active>#{index + 1}</DevTag>
                    <span className="text-xs font-bold text-muted">{repo.stars?.toLocaleString() ?? 0} stars</span>
                  </div>
                  <h3 className="line-clamp-1 text-base font-black text-ink">{repo.repo_full_name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{repo.beginner_summary ?? repo.description ?? '학습과 프로젝트 참고 가치가 있는 저장소입니다.'}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-muted">{reasons[0]}</p>
                </Link>
              ))}
              {!topRepos.length && <div className="border border-outline-soft bg-surface p-4 text-sm text-muted">오픈소스 데이터를 준비 중입니다.</div>}
            </div>
          </div>

          <div className="border border-outline-soft bg-white p-5">
            <DevSectionHeader
              eyebrow="today_build"
              title="오늘 도전해볼 프로젝트"
              action={<Link href="/projects" className="text-xs font-bold uppercase text-ink hover:underline">프로젝트 보기</Link>}
            />
            <div className="space-y-3">
              {todayProjects.map(({ item: project, reasons }) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block border border-outline-soft bg-surface-lowest p-4 hover:border-ink">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <DevTag active>{project.level ?? '추천'}</DevTag>
                    {project.duration_days && <DevTag>{project.duration_days}일</DevTag>}
                  </div>
                  <h3 className="text-base font-black leading-snug text-ink">{cleanProjectTitle(project.title)}</h3>
                  {project.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{project.description}</p>}
                  <p className="mt-2 text-xs font-bold uppercase text-muted">{reasons[0]}</p>
                </Link>
              ))}
              {!todayProjects.length && <div className="border border-outline-soft bg-surface p-4 text-sm text-muted">프로젝트 추천을 준비 중입니다.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-outline-soft bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="border border-outline-soft bg-surface p-5">
            <DevSectionHeader
              eyebrow="ai_tools_rank"
              title="요즘 많이 보는 AI 제품"
              action={<Link href="/ai-products" className="text-xs font-bold uppercase text-ink hover:underline">AI 제품 보기</Link>}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {topProducts.map(({ item: product, reasons }, index) => (
                <Link key={product.id} href={`/ai-products/${product.id}`} className="border border-outline-soft bg-white p-4 hover:border-ink">
                  <div className="mb-3 flex items-center justify-between">
                    <DevTag active>#{index + 1}</DevTag>
                    <span className="text-xs font-bold uppercase text-muted">{scoreLabel(product.score)}</span>
                  </div>
                  <h3 className="line-clamp-1 text-base font-black text-ink">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{product.description ?? product.target_user ?? '개발 워크플로우에 붙여볼 만한 AI 제품입니다.'}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-muted">{reasons[0]}</p>
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
    const publishedNews = news.filter((item) => Boolean(item.content?.trim()));
    const latestNews = [...publishedNews]
      .sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime())
      .slice(0, 2);

    // profiles.full_name → user_metadata.full_name → 이메일 앞자리 순서로 표시 이름 결정
    let userName = user.email?.split('@')[0] ?? '개발자';
    if (supabase) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const fullName = profileData?.full_name ?? (user.user_metadata?.full_name as string | undefined);
      if (fullName?.trim()) userName = fullName.trim();
    }
    let onboardingAnswers: Record<string, unknown> | null = null;
    let shouldShowOnboarding = false;

    if (supabase) {
      const { data } = await supabase
        .from('user_onboarding')
        .select('id,answers')
        .eq('user_id', user.id)
        .maybeSingle();

      shouldShowOnboarding = !data;
      onboardingAnswers = (data?.answers ?? null) as Record<string, unknown> | null;
    }
    const profile = buildRecommendationProfile(onboardingAnswers, scrapTokens(userScraps));
    const recommendedNews = recommendNewsItems(publishedNews, profile, 5);
    const recommendedRepos = recommendGitHubRepos(githubRepos, profile, 3);
    const recommendedProjects = recommendProjectIdeas(projects, profile, 3);
    const recommendedProducts = recommendAIProducts(aiProducts, profile, 4);

    return (
      <>
        {shouldShowOnboarding && <OnboardingModal userId={user.id} email={user.email ?? null} />}
        <Header />
        <LoggedInHome
          userName={userName}
          recommendedNews={recommendedNews}
          latestNews={latestNews}
          githubRepos={recommendedRepos}
          projects={recommendedProjects}
          aiProducts={recommendedProducts}
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
  const publishedNews = news.filter((item) => Boolean(item.content?.trim()));
  const topTrend = trends[0];
  const latestProject = projects[0];
  const popularNews = [...publishedNews].sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0)).slice(0, 4);

  return (
    <>
      <Header />
      <main className="grow overflow-hidden">
        <section className="relative border-b border-ink bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10 lg:py-12">
            <div className="mb-7 flex flex-col gap-3 border-b border-outline-soft pb-4 md:flex-row md:items-center md:justify-between">
              <div className="inline-flex w-fit items-center gap-2 border border-ink bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
                <TerminalSquare className="h-3.5 w-3.5" />
                what_is_seedup.ts
              </div>
              <div className="flex flex-wrap gap-2">
                <DevTag active>Developer Newsletter</DevTag>
                <DevTag>AI / OSS / Papers</DevTag>
              </div>
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
              <h1 className="max-w-2xl text-balance text-4xl font-black leading-tight text-ink md:text-5xl">
                흩어진 AI·개발 트렌드를 당신의 커리어에 맞게 정리해드립니다
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted md:text-lg">
                Seedup은 뉴스, 오픈소스, 논문, AI 제품을 수집하고 전처리한 뒤 관심사·직무·수준·목표에 맞춰 개인화된 개발 뉴스레터로 조립합니다.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex h-12 items-center gap-2 bg-ink px-6 text-sm font-bold text-white transition-opacity hover:opacity-90">
                  무료로 시작하기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/trends" className="inline-flex h-12 items-center border border-outline-soft bg-white px-6 text-sm font-bold text-ink transition-colors hover:border-ink">
                  서비스 둘러보기
                </Link>
              </div>

              <div className="mt-7 grid max-w-2xl grid-cols-3 border-y border-outline-soft py-4">
                {[
                  [`${trends.length}개`, '트렌드 분석 중'],
                  [`${projects.length}개`, '프로젝트 아이디어'],
                  [`${publishedNews.length}개`, '발행된 아티클'],
                ].map(([value, label], index) => (
                  <div key={label} className={index === 0 ? '' : 'border-l border-outline-soft pl-4'}>
                    <div className="text-3xl font-black leading-none text-ink md:text-4xl">{value}</div>
                    <div className="mt-2 text-xs font-bold uppercase text-muted md:text-sm">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
                {START_CARDS.map((card) => (
                  <DevCard key={card.href} as={Link} href={card.href} className="p-4">
                    <card.icon className="mb-4 h-5 w-5 text-ink" />
                    <h2 className="text-sm font-black leading-5 text-ink">{card.title}</h2>
                    <p className="mt-2 text-xs font-semibold leading-5 text-muted">{card.desc}</p>
                  </DevCard>
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
                  <div className="mt-12 min-h-[150px] border-l border-outline-soft pl-4 text-sm leading-7 text-ink md:min-h-[190px]">
                    <div className="typing-line">collecting_ai_news()</div>
                    <div className="mt-3 text-muted">summarize.kr()</div>
                    <div className="text-muted">rank_open_source()</div>
                    <div className="text-muted">generate_project_idea()</div>
                  </div>
                  <div className="mt-6 inline-flex bg-ink px-3 py-2 text-xs font-bold uppercase text-white">
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
