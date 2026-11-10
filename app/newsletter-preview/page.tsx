import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getAIProducts, getGitHubTrends, getNewsItems, getProjectIdeas, getResearchPapers } from '@/lib/data';
import {
  DEMO_NEWSLETTER_PROFILES,
  isRecommendableNewsItem,
  pickNewsletterSections,
  scoreNewsletterItems,
  toNewsletterContentItems,
  type ScoredNewsletterItem,
} from '@/lib/recommendations';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '뉴스레터 미리보기',
};

const SECTION_LABELS = [
  ['dailyBriefing', '오늘의 핵심 뉴스'],
  ['productRadar', '오늘의 AI 제품'],
  ['githubPick', '오늘의 저장소'],
  ['buildIdea', '만들어 볼 것'],
  ['careerTip', '커리어'],
  ['deepDive', '깊이 읽을 글'],
  ['paperToProject', '논문에서 프로젝트로'],
] as const;

export default async function NewsletterPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const params = await searchParams;
  const profile = DEMO_NEWSLETTER_PROFILES.find((item) => item.user_id === params.profile) ?? DEMO_NEWSLETTER_PROFILES[0];
  const [news, products, repos, projects, papers] = await Promise.all([
    getNewsItems(),
    getAIProducts(),
    getGitHubTrends(),
    getProjectIdeas(),
    getResearchPapers(20),
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
  const selectedCount = SECTION_LABELS.reduce((sum, [key]) => sum + sections[key].length, 0);

  return (
    <>
      <Header />
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="뉴스레터 미리보기"
            description="같은 자료라도 읽는 사람에 따라 고르는 글이 달라집니다. 예시 프로필 세 개로 어떻게 달라지는지 보여 줍니다."
            meta={<>최근 <span className="num text-ink">{lookbackDays}</span>일 · 후보 <span className="num text-ink">{scored.length}</span>개 중 <span className="num text-ink">{selectedCount}</span>개를 골랐습니다</>}
          />

          <section className="grid gap-4 lg:grid-cols-3">
            {DEMO_NEWSLETTER_PROFILES.map((demoProfile) => {
              const active = demoProfile.user_id === profile.user_id;
              return (
                <Link
                  key={demoProfile.user_id}
                  href={`/newsletter-preview?profile=${demoProfile.user_id}`}
                  aria-current={active ? 'true' : undefined}
                  className={`card block p-5 transition-colors md:p-6 ${active ? 'border-ink' : 'hover:border-outline-strong'}`}
                >
                  <p className="text-[13px] text-muted">{demoProfile.frequency === 'weekly' ? '매주' : '매일'}{active ? ' · 지금 보는 프로필' : ''}</p>
                  <h2 className="mt-1.5 text-lg font-bold text-ink">{demoProfile.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {demoProfile.level} · {demoProfile.goals.slice(0, 2).join(' / ')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {demoProfile.interests.slice(0, 3).map((tag) => <span key={tag} className="chip">{tag}</span>)}
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-9">
              {SECTION_LABELS.map(([key, label]) => (
                sections[key].length ? <NewsletterSection key={key} title={label} items={sections[key]} /> : null
              ))}
            </div>

            <aside className="card h-fit p-5 md:p-6">
              <h2 className="label">받는 사람에게 보이는 머리말</h2>
              <p className="mt-2 text-xl font-extrabold leading-snug tracking-tight text-ink">{profile.label}를 위한 이번 주 개발 브리핑</p>
              <p className="mt-3 text-sm leading-7 text-muted">
                {profile.interests.join(', ')} 관심사와 {profile.goals.join(', ')} 목표에 맞춰 골랐습니다. 뉴스는 짧게 훑고, 만들어 볼 수 있는 것은 따로 모았습니다.
              </p>
              <div className="mt-5 border-t border-outline-soft pt-4">
                <h3 className="label">이 프로필</h3>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[profile.level, ...profile.preferred_stack.slice(0, 3)].map((tag) => <span key={tag} className="chip">{tag}</span>)}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function NewsletterSection({ title, items }: { title: string; items: ScoredNewsletterItem[] }) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 text-xl font-extrabold tracking-tight text-ink">{title} <span className="num text-base font-medium text-muted">{items.length}</span></h2>
      <div className="mt-3 grid gap-3">
        {items.map(({ content, score, reasons }) => (
          <Link key={content.id} href={content.href} className="card block p-5 transition-colors hover:border-outline-strong md:p-6">
            <p className="flex items-center justify-between gap-3 text-[13px] text-muted">
              <span className="font-bold text-ink">{content.sourceLabel}</span>
              <span>맞춤 점수 <span className="num text-ink">{Math.round(score)}</span></span>
            </p>
            <h3 className="mt-2 text-lg font-bold leading-snug text-ink">{content.title}</h3>
            <p className="mt-2 text-[15px] leading-7 text-muted">{content.metadata.short_summary}</p>
            {reasons.length > 0 && (
              <ul className="mt-3 border-l-2 border-outline-strong pl-3 text-[13px] leading-6 text-muted">
                {reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            )}
          </Link>
        ))}
      </div>
    </section>
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
