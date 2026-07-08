import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ArrowRight, Bookmark, Calendar, Code2, FileText, Languages, Lightbulb, Search, Sparkles, TrendingUp } from 'lucide-react';
import { getNewsItems, getProjectIdeas, getResearchPapers, getScraps, getTrends } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import OnboardingModal from '@/components/OnboardingModal';

const STEPS = [
  { icon: Search, title: 'Article Collection', desc: '매일 최신 기술 뉴스와 글 수집' },
  { icon: Languages, title: 'Beginner Translation', desc: '초보자 눈높이로 쉬운 용어 해설' },
  { icon: TrendingUp, title: 'Trend Scoring', desc: '구현 가능성과 포트폴리오 가치 평가' },
  { icon: Lightbulb, title: 'Project Ideas', desc: '수준별 맞춤 프로젝트 도출' },
  { icon: Calendar, title: '7-Day Build Plan', desc: '작게 완성하는 실행 플랜 제공' },
];

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
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1280px] items-center gap-12 px-4 py-16 md:px-10 lg:grid-cols-12 lg:py-20">
            <div className="lg:col-span-6">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-soft bg-white px-3 py-1 text-xs font-semibold text-brand-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Seed to Code Pipeline
              </div>
              <h1 className="text-balance text-5xl font-bold leading-tight text-ink md:text-[64px]">
                개발 뉴스,
                <br />
                읽고 끝내지 말고
                <br />
                <span className="text-brand-primary">만들어보세요.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
                신뢰할 수 있는 개발 뉴스와 제품 트렌드를 초보자 눈높이로 해석하고, 바로 만들 수 있는 프로젝트 아이디어와 7일 빌드 플랜으로 바꿔드립니다.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/projects" className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  이번 주 아이디어 보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/news" className="inline-flex h-12 items-center rounded-lg border border-outline-soft bg-white px-6 text-sm font-semibold text-ink transition-colors hover:border-brand-primary hover:text-brand-primary">
                  아티클 둘러보기
                </Link>
              </div>
              <div className="mt-12 grid max-w-xl grid-cols-3 border-y border-outline-soft/70 py-5">
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
                    Article to Build
                  </div>
                  <span className="rounded-md bg-surface-low px-3 py-1 text-xs font-medium text-muted">Live Example</span>
                </div>
                <div className="space-y-4 border-l border-outline-soft pl-6">
                  {[
                    { icon: FileText, label: 'RAW SEED (ARTICLE)', title: latestNews?.title ?? 'Supabase에 news_items 데이터를 넣으면 최신 아티클이 표시됩니다.', tone: 'muted' },
                    { icon: Languages, label: 'TREND CONTEXT', title: topTrend?.summary ?? 'Supabase에 trends 데이터를 넣으면 트렌드 해석이 표시됩니다.', tone: 'active' },
                    { icon: Code2, label: 'RECOMMENDED PROJECT', title: latestProject?.title ?? 'Supabase에 project_ideas 데이터를 넣으면 추천 프로젝트가 표시됩니다.', tone: 'project' },
                    { icon: Sparkles, label: 'PORTFOLIO POINTS', title: latestProject?.description ?? '데이터가 연결되면 프로젝트 설명과 빌드 포인트가 이 영역에 표시됩니다.', tone: 'muted' },
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
                    Personalized
                  </div>
                  <h2 className="text-3xl font-bold text-ink">추천 아티클</h2>
                  <p className="mt-2 text-muted">온보딩에서 고른 관심사와 수준을 기준으로 먼저 볼 글을 골랐습니다.</p>
                </div>
                <Link href="/news" className="text-sm font-bold text-brand-primary hover:underline">전체 아티클</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {recommendedNews.map((item) => (
                  <Link key={item.id} href={`/news/${item.id}`} className="group rounded-xl border border-outline-soft bg-white p-5 hover:border-brand-primary">
                    <div className="mb-2 text-xs font-bold text-brand-primary">{item.category ?? '아티클'}</div>
                    <h3 className="line-clamp-2 text-lg font-bold leading-snug text-ink group-hover:text-brand-primary">{item.title}</h3>
                    {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.summary}</p>}
                  </Link>
                ))}
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
                    My Scrap
                  </div>
                  <h2 className="text-2xl font-bold text-ink">내 스크랩 목록</h2>
                </div>
                <Link href="/scrap" className="text-sm font-bold text-brand-primary hover:underline">스크랩북</Link>
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
                      마음에 드는 아티클이나 프로젝트를 스크랩하면 여기에 표시됩니다.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-outline-soft bg-white p-4 text-sm leading-6 text-muted">
                  로그인하면 관심 있는 글과 프로젝트를 스크랩해서 이어서 볼 수 있습니다.
                </div>
              )}
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
