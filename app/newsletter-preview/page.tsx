import type { Metadata } from 'next';
import { updateNewsletterSubscription } from '@/app/actions/profile';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Logo from '@/components/Logo';
import SubmitButton from '@/components/SubmitButton';
import { getAIProducts, getGitHubTrends, getNewsItems, getProjectIdeas, getResearchPapers } from '@/lib/data';
import { getOpportunities } from '@/lib/opportunities/data';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';
import {
  DEMO_NEWSLETTER_PROFILES,
  isRecommendableNewsItem,
  pickNewsletterSections,
  scoreNewsletterItems,
  toNewsletterContentItems,
} from '@/lib/recommendations';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '주간 신호',
};

const SECTION_KEYS = ['dailyBriefing', 'productRadar', 'githubPick', 'buildIdea', 'careerTip', 'deepDive', 'paperToProject'] as const;
const READS_IN_MAIL = 5;

export default async function NewsletterPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const params = await searchParams;
  const profile = DEMO_NEWSLETTER_PROFILES.find((item) => item.user_id === params.profile) ?? DEMO_NEWSLETTER_PROFILES[0];
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const [news, products, repos, projects, papers, { opportunities }, onboarding, dossiers] = await Promise.all([
    getNewsItems(),
    getAIProducts(),
    getGitHubTrends(),
    getProjectIdeas(),
    getResearchPapers(20),
    getOpportunities(),
    user && supabase ? supabase.from('user_onboarding').select('newsletter_subscribed').eq('user_id', user.id).maybeSingle() : null,
    user && supabase ? supabase.from('evidence_dossiers').select('opportunity_slug').not('opportunity_slug', 'is', null).limit(50) : null,
  ]);
  const lookbackDays = getLookbackDays(news.length + products.length + repos.length + projects.length + papers.length);
  const cutoff = getCutoffTimestamp(lookbackDays);
  const items = toNewsletterContentItems({
    news: news.filter((item) => isInLookback(item.published_at, cutoff) && isRecommendableNewsItem(item)),
    products,
    repos: repos.filter((item) => isInLookback(item.pushed_at, cutoff)),
    projects,
    papers: papers.filter((item) => isInLookback(item.published_at ?? item.created_at, cutoff)),
  });
  const scored = scoreNewsletterItems(items.length ? items : buildFallbackItems(), profile);
  const sections = pickNewsletterSections(scored);
  const reads = SECTION_KEYS.flatMap((key) => sections[key]).slice(0, READS_IN_MAIL);

  const subscribed = onboarding?.data?.newsletter_subscribed ?? true;
  // A problem is watched once the reader has saved quotes from it.
  const watchedSlugs = new Set((dossiers?.data ?? []).map((row) => row.opportunity_slug as string));
  const watched = opportunities.filter((item) => watchedSlugs.has(item.slug));
  const ranked = [...opportunities].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length);
  const passed = ranked.find((item) => item.qualified);
  const moved = ranked.filter((item) => item !== passed).slice(0, 2);
  const quote = passed?.evidence[0];

  return (
    <>
      <Header />
      <main id="main-content" className="grid grow lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <section className="border-outline-soft bg-white px-5 py-10 sm:px-8 lg:border-r lg:px-12 lg:py-16">
          <h1 className="page-intro-title">주간 신호</h1>
          <p className="page-intro-description">지켜보는 문제가 어떻게 움직였는지, 관심 분야에서 무엇이 새로 검증됐는지, 무엇을 읽으면 좋을지 골라 보냅니다.</p>

          <h2 className="mt-10 text-sm font-semibold">관심 분야</h2>
          <nav className="seg mt-3" aria-label="예시 프로필">
            {DEMO_NEWSLETTER_PROFILES.map((demo) => (
              <Link key={demo.user_id} href={`/newsletter-preview?profile=${demo.user_id}`} scroll={false} aria-current={demo.user_id === profile.user_id ? 'true' : undefined}>{demo.label}</Link>
            ))}
          </nav>
          <p className="mt-3 text-sm leading-6 text-tertiary">{profile.interests.join(', ')}</p>
          <p className="mt-1 text-[13px] leading-6 text-muted">예시 프로필로 미리 봅니다. 실제 메일은 내 관심 분야를 기준으로 고릅니다. <Link href="/onboarding" className="text-seed underline-offset-4 hover:underline">관심 분야 설정하기</Link></p>

          <h2 className="mt-10 text-sm font-semibold">지켜보는 문제</h2>
          {watched.length ? (
            <ul className="rows mt-3">
              {watched.map((item) => (
                <li key={item.slug}>
                  <Link href={`/opportunities/${item.slug}`} className="flex items-baseline justify-between gap-4 py-3.5 text-[15px] hover:bg-surface-low">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className={`shrink-0 text-sm ${item.qualified ? 'font-medium text-seed' : 'text-muted'}`}>{item.qualified ? '기준 통과' : `원문 ${item.evidence.length}건`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-y border-outline-soft py-4 text-sm leading-6 text-muted">아직 지켜보는 문제가 없습니다. <Link href="/opportunities" className="text-seed underline-offset-4 hover:underline">기회 살펴보기</Link></p>
          )}
          <p className="mt-3 text-[13px] text-muted">원문을 담은 문제는 자동으로 추가됩니다.</p>

          <h2 className="mt-10 text-sm font-semibold">받는 방식</h2>
          <p className="mt-3 text-[15px]">매주 월요일 정리</p>
          <p className="mt-0.5 text-sm text-muted">기준 통과, 움직인 문제, 읽을거리</p>
          {user ? (
            <form action={updateNewsletterSubscription} className="mt-5 flex flex-wrap items-center gap-3">
              <input type="hidden" name="subscribed" value={subscribed ? 'false' : 'true'} />
              <SubmitButton pendingText="저장 중" className={subscribed ? 'btn-quiet' : 'btn'}>{subscribed ? '구독 해지' : '주간 신호 구독'}</SubmitButton>
              <span className="text-sm text-muted">{subscribed ? `${user.email}로 받고 있습니다.` : '지금은 받지 않습니다.'}</span>
            </form>
          ) : (
            <Link href="/login?next=/newsletter-preview" className="btn mt-5">로그인하고 구독하기</Link>
          )}
        </section>

        <section className="bg-surface-mid px-5 py-10 sm:px-8 lg:px-12 lg:py-16" aria-labelledby="mail-heading">
          <div className="mx-auto max-w-[680px]">
            <h2 id="mail-heading" className="text-[13px] text-muted">다음 메일 미리보기</h2>
            <article className="card mt-3 p-6 shadow-[0_12px_40px_rgba(0,0,0,.06)] sm:p-11">
              <p className="flex items-center gap-2 text-sm font-semibold"><Logo className="h-4 w-4" />Seedup 주간 신호</p>
              <p className="mt-5 text-[clamp(22px,2.6vw,26px)] font-bold leading-snug tracking-[-0.02em] [text-wrap:balance]">
                {passed ? '이번 주, 기준을 통과한 문제가 있습니다.' : '이번 주에 움직인 문제와 읽을거리입니다.'}
              </p>

              {passed && (
                <section className="mt-9">
                  <h3 className="text-[13px] text-muted">기준 통과</h3>
                  <p className="mt-2 text-lg font-semibold">{passed.name}</p>
                  <p className="mt-1 text-sm text-muted">원문 {passed.evidence.length}건 · {passed.directCount ? `직접 경쟁 도구 ${passed.directCount}개` : '직접 경쟁 도구 없음'}</p>
                  {quote && (
                    <blockquote className="mt-4 border-l-2 border-seed pl-4">
                      <p lang="en" className="text-[15px] leading-7">“{quote.quote}”</p>
                      <footer className="mt-1 text-[13px] text-muted">{PLATFORM_LABELS[quote.platform]}</footer>
                    </blockquote>
                  )}
                  <Link href={`/prd?opportunity=${encodeURIComponent(passed.slug)}`} className="btn mt-5">이 문제로 PRD 만들기</Link>
                </section>
              )}

              {moved.length > 0 && (
                <section className="mt-9">
                  <h3 className="text-[13px] text-muted">움직인 문제</h3>
                  <ul className="mt-1 divide-y divide-outline-soft border-b border-outline-soft">
                    {moved.map((item) => {
                      const before = item.history?.at(-2);
                      return (
                        <li key={item.slug}>
                          <Link href={`/opportunities/${item.slug}`} className="flex items-baseline justify-between gap-4 py-3.5 text-[15px] hover:underline hover:underline-offset-4">
                            <span className="min-w-0 truncate">{item.name}</span>
                            <span className="shrink-0 text-sm text-muted">{before && before.evidence !== item.evidence.length ? `원문 ${before.evidence}건 → ${item.evidence.length}건` : `원문 ${item.evidence.length}건`}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {reads.length > 0 && (
                <section className="mt-9">
                  <h3 className="text-[13px] text-muted">읽을거리 · <span className="font-semibold text-tertiary">{profile.interests.slice(0, 2).join(', ')}</span></h3>
                  <ul className="mt-1 divide-y divide-outline-soft">
                    {reads.map(({ content, reasons }) => (
                      <li key={content.id}>
                        <Link href={content.href} className="block py-4 hover:underline hover:underline-offset-4">
                          <span className="block text-[15px] font-medium leading-6">{content.title}</span>
                          <span className="mt-1 block text-[13px] text-muted">{[content.sourceLabel, reasons[0]].filter(Boolean).join(' · ')}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="mt-9 text-[13px] text-muted">최근 {lookbackDays}일 · 후보 {scored.length}개 중에서 골랐습니다.</p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function getLookbackDays(totalCount: number) {
  if (totalCount >= 40) return 1;
  if (totalCount >= 20) return 7;
  return 14;
}

function getCutoffTimestamp(lookbackDays: number) {
  return new Date().getTime() - lookbackDays * 24 * 60 * 60 * 1000;
}

function isInLookback(value: string | null | undefined, cutoff: number) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time >= cutoff : true;
}

function buildFallbackItems() {
  return toNewsletterContentItems({
    news: [],
    products: [],
    repos: [],
    projects: [
      {
        id: 'demo-build',
        title: 'AI 개발 뉴스 개인화 브리핑 봇',
        description: 'RSS와 GitHub 신호를 모아 사용자 관심사별로 슬랙 또는 이메일 브리핑을 보내는 미니 서비스입니다.',
        level: '초보자',
        duration_days: 7,
        stack: ['Next.js', 'Supabase', 'OpenRouter API'],
        related_trend: 'AI 뉴스레터',
        portfolio_value: '수집, 전처리, 추천, 발송까지 제품형 파이프라인을 보여줄 수 있습니다.',
        plan: [],
      },
    ],
    papers: [],
  });
}
