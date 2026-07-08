import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ArrowRight, Bookmark, Calendar, Code2, FileText, Languages, Lightbulb, Search, Sparkles, TrendingUp } from 'lucide-react';
import { getNewsItems, getProjectIdeas, getResearchPapers, getScraps, getTrends } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import OnboardingModal from '@/components/OnboardingModal';
import { cleanProjectTitle } from '@/lib/utils';

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

export default async function Home() {
  const supabase = await createClient();
  const [news, trends, projects, researchPapers, userResult] = await Promise.all([
    getNewsItems(),
    getTrends(),
    getProjectIdeas(),
    getResearchPapers(6),
    supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }),
  ]);
  const latestNews = news[0];
  const topTrend = trends[0];
  const latestProject = projects[0];
  const user = userResult.data.user;
  const popularNews = [...news].sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0)).slice(0, 4);
  const userScraps = user ? await getScraps() : [];
  const userName = user?.email?.split('@')[0] ?? '개발자';
  const savedCounts = userScraps.reduce<Record<string, number>>((acc, item) => {
    acc[item.item_type] = (acc[item.item_type] ?? 0) + 1;
    return acc;
  }, {});
  let recommendedNews = popularNews;
  let shouldShowOnboarding = false;

  if (supabase && user) {
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
      {shouldShowOnboarding && user && <OnboardingModal userId={user.id} email={user.email ?? null} />}
      <Header />
      <main className="grow overflow-hidden">
        <section className="dot-grid relative border-b border-outline-soft/60 bg-surface">
          <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-10 md:px-10 md:py-14 lg:grid-cols-12 lg:py-16">
            <div className="lg:col-span-6">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-soft bg-white px-3 py-1 text-xs font-semibold text-brand-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {user ? 'Personal Dashboard' : 'Developer Growth Platform'}
              </div>
              {user ? (
                <h1 className="text-balance text-5xl font-bold leading-tight text-ink md:text-[64px]">
                  {userName}님,
                  <br />
                  오늘 이어서
                  <br />
                  <span className="text-brand-primary">읽고 만들 것부터 볼까요?</span>
                </h1>
              ) : (
                <h1 className="text-balance text-5xl font-bold leading-tight text-ink md:text-[64px]">
                  개발 트렌드,
                  <br />
                  그냥 읽지 말고
                  <br />
                  <span className="text-brand-primary">내 성장으로 연결하세요.</span>
                </h1>
              )}
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
                {user
                  ? '관심사, 저장한 콘텐츠, 최신 개발 흐름을 기준으로 오늘 이어서 볼 아티클과 프로젝트 후보를 정리했습니다.'
                  : 'Seedup은 개발 뉴스, 논문, GitHub 오픈소스, AI 제품 흐름을 분석해 당신에게 맞는 아티클, 논문, 프로젝트를 추천합니다.'}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={user ? '/news' : '/login'} className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  {user ? '오늘 추천 보기' : '내 맞춤 추천 시작하기'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={user ? '/scrap' : '/trends'} className="inline-flex h-12 items-center rounded-lg border border-outline-soft bg-white px-6 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
                  {user ? '저장한 것 이어보기' : '오늘의 트렌드 둘러보기'}
                </Link>
              </div>
              <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
                {(user
                  ? [
                    { icon: FileText, title: `${recommendedNews.length}개 추천`, desc: '내 관심사 기반 오늘 읽기', href: '/news' },
                    { icon: Bookmark, title: `${userScraps.length}개 저장`, desc: '내 보관함에서 이어보기', href: '/scrap' },
                    { icon: Code2, title: `${projects.length}개 후보`, desc: '프로젝트로 만들기', href: '/projects' },
                  ]
                  : START_CARDS
                ).map((card) => (
                  <Link key={card.href} href={card.href} className="group rounded-lg border border-outline-soft bg-white p-4 transition-colors hover:border-brand-primary">
                    <card.icon className="mb-4 h-5 w-5 text-brand-primary" />
                    <h2 className="text-sm font-bold leading-5 text-ink">{card.title}</h2>
                    <p className="mt-2 text-xs font-semibold leading-5 text-muted group-hover:text-brand-primary">{card.desc}</p>
                  </Link>
                ))}
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 border-y border-outline-soft/70 py-5">
                {[
                  [`${trends.length}개`, '트렌드 분석 중'],
                  [`${projects.length}개`, '프로젝트 아이디어'],
                  [`${news.length}개`, '아티클 수집됨'],
                ].map(([value, label], index) => (
                  <div key={label} className={index === 0 ? '' : 'border-l border-outline-soft/70 pl-5'}>
                    <div className="text-3xl font-bold text-ink">{value}</div>
                    <div className="mt-1 text-xs font-medium text-muted">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl border border-outline-soft bg-white/90 p-5 shadow-[0_16px_60px_rgba(25,28,29,0.06)] backdrop-blur">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <Code2 className="h-5 w-5 text-brand-primary" />
                    {user ? '나의 오늘 흐름' : '읽을거리에서 프로젝트까지'}
                  </div>
                  <span className="rounded-md bg-surface-low px-3 py-1 text-xs font-medium text-muted">{user ? '개인화' : '오늘의 흐름'}</span>
                </div>
                <div className="space-y-4 border-l border-outline-soft pl-6">
                  {[
                    { icon: FileText, label: user ? '오늘 읽기' : '추천 아티클', title: (user ? recommendedNews[0]?.title : latestNews?.title) ?? 'Supabase에 news_items 데이터를 넣으면 최신 아티클이 표시됩니다.', tone: 'muted' },
                    { icon: Languages, label: user ? '저장한 맥락' : '초보자용 이해', title: user ? (userScraps[0]?.title ?? '아직 저장한 콘텐츠가 없습니다. 마음에 드는 글을 저장하면 이어보기 흐름이 생깁니다.') : (topTrend?.summary ?? 'Supabase에 trends 데이터를 넣으면 트렌드 해석이 표시됩니다.'), tone: 'active' },
                    { icon: Code2, label: '연결 프로젝트', title: latestProject ? cleanProjectTitle(latestProject.title) : 'Supabase에 project_ideas 데이터를 넣으면 추천 프로젝트가 표시됩니다.', tone: 'project' },
                    { icon: Sparkles, label: '포트폴리오 포인트', title: latestProject?.description ?? '데이터가 연결되면 프로젝트 설명과 빌드 포인트가 이 영역에 표시됩니다.', tone: 'muted' },
                  ].map((item) => (
                    <div key={item.label} className="relative">
                      <span className={`absolute -left-[29px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-white ${item.tone === 'project' ? 'bg-brand-primary' : 'bg-outline-soft'}`} />
                      <div className={`rounded-lg border p-4 ${item.tone === 'project' ? 'border-brand-primary/30 bg-white shadow-sm' : 'border-surface-high bg-surface-lowest'}`}>
                        <div className="flex gap-4">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.tone === 'project' ? 'bg-brand-primary text-white' : 'border border-surface-high bg-white text-muted'}`}>
                            <item.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-bold text-brand-primary">{item.label}</div>
                            <div className="text-sm font-medium leading-6 text-ink">{item.title}</div>
                            {item.tone === 'project' && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(latestProject?.stack ?? []).map((stack) => (
                                  <span key={stack} className="rounded border border-surface-high bg-surface px-2 py-1 text-xs text-muted">{stack}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {user && (
          <section className="border-b border-outline-soft/60 bg-surface py-16">
            <div className="mx-auto max-w-[1280px] px-4 md:px-10">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                    <Sparkles className="h-4 w-4" />
                    오늘 할 일
                  </div>
                  <h2 className="text-3xl font-bold text-ink">맞춤 추천으로 이어보기</h2>
                  <p className="mt-2 text-muted">관심사와 저장한 흐름을 기준으로 오늘 읽고 만들어볼 항목을 먼저 보여드립니다.</p>
                </div>
                <Link href="/news" className="text-sm font-bold text-brand-primary hover:underline">전체 아티클</Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                <div className="rounded-xl border border-outline-soft bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-ink">오늘 읽기</h3>
                    <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">{recommendedNews.length}개</span>
                  </div>
                  <div className="space-y-3">
                    {recommendedNews.slice(0, 3).map((item) => (
                      <Link key={item.id} href={`/news/${item.id}`} className="group block rounded-lg border border-outline-soft bg-surface-lowest p-4 hover:border-brand-primary">
                        <div className="mb-1 text-xs font-bold text-brand-primary">{item.category ?? '아티클'}</div>
                        <h4 className="line-clamp-2 text-sm font-bold leading-5 text-ink group-hover:text-brand-primary">{item.title}</h4>
                        {item.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{item.summary}</p>}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-outline-soft bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-ink">저장한 것</h3>
                    <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">{userScraps.length}개</span>
                  </div>
                  <div className="space-y-3">
                    {userScraps.slice(0, 3).map((item) => (
                      <Link key={item.id} href={`/scrap/${item.id}`} className="block rounded-lg border border-outline-soft bg-surface-lowest p-4 transition-colors hover:border-brand-primary">
                        <div className="mb-1 text-xs font-bold text-brand-primary">{SAVED_TYPE_LABELS[item.item_type] ?? item.item_type}</div>
                        <h4 className="line-clamp-2 text-sm font-bold leading-5 text-ink">{item.title}</h4>
                      </Link>
                    ))}
                    {!userScraps.length && (
                      <Link href="/news" className="block rounded-lg border border-dashed border-outline-soft bg-surface-lowest p-4 text-sm leading-6 text-muted hover:border-brand-primary">
                        읽다가 중요한 콘텐츠를 저장하면 이 칸에서 바로 이어볼 수 있습니다.
                      </Link>
                    )}
                  </div>
                  {!!Object.keys(savedCounts).length && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(savedCounts).slice(0, 4).map(([type, count]) => (
                        <span key={type} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                          {SAVED_TYPE_LABELS[type] ?? type} {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-outline-soft bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-ink">바로 만들기</h3>
                    <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">프로젝트</span>
                  </div>
                  {latestProject ? (
                    <Link href={`/projects/${latestProject.id}`} className="group block rounded-lg border border-outline-soft bg-surface-lowest p-4 hover:border-brand-primary">
                      <div className="mb-2 text-xs font-bold text-brand-primary">{latestProject.level ?? '추천'}</div>
                      <h4 className="text-base font-bold leading-6 text-ink group-hover:text-brand-primary">{cleanProjectTitle(latestProject.title)}</h4>
                      {latestProject.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{latestProject.description}</p>}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(latestProject.stack ?? []).slice(0, 4).map((stack) => (
                          <span key={stack} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted">{stack}</span>
                        ))}
                      </div>
                    </Link>
                  ) : (
                    <Link href="/projects" className="block rounded-lg border border-dashed border-outline-soft bg-surface-lowest p-4 text-sm leading-6 text-muted hover:border-brand-primary">
                      프로젝트 데이터를 넣으면 오늘 바로 만들 후보가 표시됩니다.
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="border-b border-outline-soft/60 bg-white py-16">
          <div className="mx-auto grid max-w-[1280px] gap-6 px-4 md:px-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-outline-soft bg-surface p-5 md:p-6">
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-soft pb-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                    <TrendingUp className="h-4 w-4" />
                    Weekly Popular
                  </div>
                  <h2 className="text-2xl font-bold text-ink">이번 주 인기 글</h2>
                </div>
                <Link href="/news?tab=popular" className="text-sm font-bold text-brand-primary hover:underline">전체 보기</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {popularNews.map((item, index) => (
                  <Link key={item.id} href={`/news/${item.id}`} className="group rounded-lg border border-outline-soft bg-white p-4 transition-all hover:border-brand-primary/50 hover:shadow-[0_10px_30px_rgba(25,28,29,0.06)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-brand-primary px-2.5 py-1 text-xs font-bold text-white">#{index + 1}</span>
                      <span className="text-xs font-bold text-muted">{item.category ?? 'Article'}</span>
                    </div>
                    <h3 className="line-clamp-2 text-lg font-bold leading-snug text-ink group-hover:text-brand-primary">{item.title}</h3>
                    {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.summary}</p>}
                  </Link>
                ))}
                {!popularNews.length && (
                  <div className="rounded-lg border border-outline-soft bg-white p-4 text-sm leading-6 text-muted md:col-span-2">
                    RSS 수집을 실행하면 이번 주 인기 글이 표시됩니다.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-soft bg-surface p-5 md:p-6">
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-soft pb-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                    <Bookmark className="h-4 w-4" />
                    내 보관함
                  </div>
                  <h2 className="text-2xl font-bold text-ink">최근 저장한 콘텐츠</h2>
                </div>
                <Link href="/scrap" className="text-sm font-bold text-brand-primary hover:underline">내 보관함</Link>
              </div>
              {user ? (
                <div className="space-y-3">
                  {userScraps.slice(0, 4).map((item) => (
                    <Link key={item.id} href={`/scrap/${item.id}`} className="block rounded-lg border border-outline-soft bg-white p-4 transition-colors hover:border-brand-primary">
                      <div className="mb-1 text-xs font-bold text-brand-primary">{item.tag ?? item.item_type}</div>
                      <h3 className="line-clamp-2 text-sm font-bold leading-5 text-ink">{item.title}</h3>
                    </Link>
                  ))}
                  {!userScraps.length && (
                    <div className="rounded-lg border border-outline-soft bg-white p-4 text-sm leading-6 text-muted">
                      마음에 드는 아티클이나 프로젝트를 저장하면 여기에 표시됩니다.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-outline-soft bg-white p-4 text-sm leading-6 text-muted">
                  로그인하면 관심 있는 글과 프로젝트를 저장해서 이어서 볼 수 있습니다.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-outline-soft/60 bg-surface py-16">
          <div className="mx-auto grid max-w-[1280px] gap-6 px-4 md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <Lightbulb className="h-4 w-4" />
                Idea Evaluation
              </div>
              <h2 className="text-3xl font-bold leading-tight text-ink">만들고 싶은 아이디어가 있나요?</h2>
              <p className="mt-3 max-w-xl leading-7 text-muted">
                한 문장으로 적으면 타깃 사용자, 핵심 기능, 난이도, 추천 기술 스택, 7일 실행 방향으로 이어서 정리해드립니다.
              </p>
            </div>
            <div className="rounded-xl border border-outline-soft bg-white p-5 shadow-sm">
              <form action="/ideas" className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-ink">아이디어 입력</span>
                  <textarea
                    name="idea"
                    rows={4}
                    placeholder="예: AI로 개발 뉴스를 요약해서 슬랙으로 보내주는 봇을 만들고 싶어요."
                    className="w-full resize-none rounded-lg border border-outline-soft bg-surface-lowest px-4 py-3 text-sm leading-7 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand-primary focus:bg-white"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted">
                    <span className="rounded-full bg-surface px-2.5 py-1">포트폴리오 가치</span>
                    <span className="rounded-full bg-surface px-2.5 py-1">추천 스택</span>
                    <span className="rounded-full bg-surface px-2.5 py-1">7일 플랜</span>
                  </div>
                  <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    아이디어 평가받기
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {!!researchPapers.length && (
          <section className="border-b border-outline-soft/60 bg-surface py-16">
            <div className="mx-auto max-w-[1280px] px-4 md:px-10">
              <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                    <FileText className="h-4 w-4" />
                    Research Brief
                  </div>
                  <h2 className="text-3xl font-bold text-ink">이번 주 집중해야 할 논문</h2>
                  <p className="mt-2 text-muted">원문 대신 한국어 요약과 구현 아이디어를 먼저 확인하세요.</p>
                </div>
                <Link href="/news" className="text-sm font-bold text-brand-primary hover:underline">아티클에서 보기</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {researchPapers.slice(0, 3).map((paper) => (
                  <article key={paper.id} className="rounded-xl border border-outline-soft bg-white p-5">
                    <div className="mb-3 inline-flex rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">{paper.review_type ?? '논문 리뷰'}</div>
                    <h3 className="line-clamp-2 text-lg font-bold leading-snug text-ink">{paper.title}</h3>
                    {paper.beginner_summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{paper.beginner_summary}</p>}
                    {paper.paper_url && (
                      <Link href={paper.paper_url} target="_blank" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-primary">
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

        <section className="border-b border-outline-soft/60 bg-white py-20">
          <div className="mx-auto max-w-[1280px] px-4 md:px-10">
            <div className="mb-12">
              <h2 className="text-3xl font-semibold text-ink">How it works</h2>
              <p className="mt-2 text-muted">복잡한 기술 뉴스가 당신의 포트폴리오로 변하는 과정</p>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              {STEPS.map((step, index) => (
                <div key={step.title} className="rounded-lg border border-outline-soft/70 bg-surface p-5">
                  <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full ${index === STEPS.length - 1 ? 'bg-brand-primary text-white' : 'border border-outline-soft bg-white text-ink'}`}>
                    <step.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
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
