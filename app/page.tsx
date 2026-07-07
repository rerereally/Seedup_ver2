import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ArrowRight, Calendar, Code2, FileText, Languages, Lightbulb, Search, Sparkles, TrendingUp } from 'lucide-react';
import { getNewsItems, getProjectIdeas, getTrends } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import OnboardingModal from '@/components/OnboardingModal';

const STEPS = [
  { icon: Search, title: 'News Collection', desc: '매일 최신 기술 및 제품 뉴스 수집' },
  { icon: Languages, title: 'Beginner Translation', desc: '초보자 눈높이로 쉬운 용어 해설' },
  { icon: TrendingUp, title: 'Trend Scoring', desc: '구현 가능성과 포트폴리오 가치 평가' },
  { icon: Lightbulb, title: 'Project Ideas', desc: '수준별 맞춤 프로젝트 도출' },
  { icon: Calendar, title: '7-Day Build Plan', desc: '작게 완성하는 실행 플랜 제공' },
];

export default async function Home() {
  const supabase = await createClient();
  const [news, trends, projects, userResult] = await Promise.all([
    getNewsItems(),
    getTrends(),
    getProjectIdeas(),
    supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }),
  ]);
  const latestNews = news[0];
  const topTrend = trends[0];
  const latestProject = projects[0];
  const user = userResult.data.user;
  let shouldShowOnboarding = false;

  if (supabase && user) {
    const { data } = await supabase
      .from('user_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    shouldShowOnboarding = !data;
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
                  뉴스 둘러보기
                </Link>
              </div>
              <div className="mt-12 grid max-w-xl grid-cols-3 border-y border-outline-soft/70 py-5">
                {[
                  [`${trends.length}개`, '트렌드 분석 중'],
                  [`${projects.length}개`, '프로젝트 아이디어'],
                  [`${news.length}개`, '뉴스 수집됨'],
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
                    News to Build
                  </div>
                  <span className="rounded-md bg-surface-low px-3 py-1 text-xs font-medium text-muted">Live Example</span>
                </div>
                <div className="space-y-4 border-l border-outline-soft pl-6">
                  {[
                    { icon: FileText, label: 'RAW SEED (NEWS)', title: latestNews?.title ?? 'Supabase에 news_items 데이터를 넣으면 최신 뉴스가 표시됩니다.', tone: 'muted' },
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
