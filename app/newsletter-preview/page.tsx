import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { DevTag } from '@/components/ui/DevCard';
import { getAIProducts, getGitHubTrends, getNewsItems, getProjectIdeas, getResearchPapers } from '@/lib/data';
import {
  DEMO_NEWSLETTER_PROFILES,
  pickNewsletterSections,
  scoreNewsletterItems,
  toNewsletterContentItems,
  type ScoredNewsletterItem,
} from '@/lib/recommendations';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';

const SECTION_LABELS = [
  ['dailyBriefing', '오늘의 핵심 뉴스'],
  ['productRadar', '오늘의 AI 제품'],
  ['githubPick', '오늘의 GitHub Pick'],
  ['buildIdea', '오늘의 Build Idea'],
  ['careerTip', '오늘의 Career Tip'],
  ['deepDive', '추천 Deep Dive'],
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
    news: news.filter((item) => isInLookback(item.published_at, cutoff)),
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
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Newsletter Preview"
            title="내 커리어에 맞춘 개발 뉴스레터"
            description="최근 7~14일 동안 수집된 뉴스, AI 제품, GitHub 저장소, 논문, 프로젝트 아이디어를 프로필별로 다시 점수화해 뉴스레터 구성을 미리 보여줍니다."
            icon={MailCheck}
            meta={(
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [`${lookbackDays}일`, '조회 범위'],
                  [`${scored.length}개`, '추천 후보'],
                  [`${selectedCount}개`, '선택된 콘텐츠'],
                ].map(([value, label]) => (
                  <div key={label} className="border border-outline-soft bg-white px-4 py-3">
                    <p className="text-2xl font-black text-ink">{value}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
                  </div>
                ))}
              </div>
            )}
          />

          <section className="grid gap-4 lg:grid-cols-3">
            {DEMO_NEWSLETTER_PROFILES.map((demoProfile) => {
              const active = demoProfile.user_id === profile.user_id;
              return (
                <Link
                  key={demoProfile.user_id}
                  href={`/newsletter-preview?profile=${demoProfile.user_id}`}
                  className={`border p-5 transition-colors ${active ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-white text-ink hover:border-ink'}`}
                >
                  <div className={`text-xs font-bold uppercase ${active ? 'text-white/70' : 'text-muted'}`}>{demoProfile.frequency}</div>
                  <h2 className="mt-2 text-xl font-black">{demoProfile.label}</h2>
                  <p className={`mt-3 text-sm leading-6 ${active ? 'text-white/75' : 'text-muted'}`}>
                    {demoProfile.level} · {demoProfile.goals.slice(0, 2).join(' / ')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {demoProfile.interests.slice(0, 3).map((tag) => <DevTag key={tag} active={active}>{tag}</DevTag>)}
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-5">
              {SECTION_LABELS.map(([key, label]) => (
                sections[key].length ? <NewsletterSection key={key} title={label} items={sections[key]} /> : null
              ))}
            </div>

            <aside className="h-fit border border-outline-soft bg-white p-5">
              <div className="text-xs font-bold uppercase text-muted">newsletter_copy.preview</div>
              <h2 className="mt-3 text-2xl font-black leading-tight text-ink">{profile.label}를 위한 이번 주 개발 브리핑</h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                {profile.interests.join(', ')} 관심사와 {profile.goals.join(', ')} 목표를 기준으로 오늘 읽을 콘텐츠를 골랐습니다.
                뉴스는 짧게 훑고, 프로젝트로 연결 가능한 항목은 Build Idea 섹션에 따로 모았습니다.
              </p>
              <div className="mt-5 border-t border-outline-soft pt-5">
                <div className="text-xs font-bold uppercase text-muted">selected_profile</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[profile.level, ...profile.preferred_stack.slice(0, 3), ...profile.preferred_roles.slice(0, 2)].map((tag) => <DevTag key={tag}>{tag}</DevTag>)}
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
    <section className="border border-outline-soft bg-white p-5">
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-soft pb-4">
        <div>
          <div className="text-xs font-bold uppercase text-muted">personalized_section</div>
          <h2 className="mt-1 text-2xl font-black text-ink">{title}</h2>
        </div>
        <DevTag active>{items.length} picks</DevTag>
      </div>
      <div className="grid gap-3">
        {items.map(({ content, score, reasons }) => (
          <Link key={content.id} href={content.href} className="border border-outline-soft bg-surface-lowest p-4 transition-colors hover:border-ink">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <DevTag active>{content.sourceLabel}</DevTag>
                <DevTag>{Math.round(score)}점</DevTag>
              </div>
              <span className="text-xs font-bold uppercase text-muted">{content.metadata.newsletter_section}</span>
            </div>
            <h3 className="mt-3 text-lg font-black leading-snug text-ink">{content.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{content.metadata.short_summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reasons.map((reason) => <DevTag key={reason}>{reason}</DevTag>)}
            </div>
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
