import type { Metadata } from 'next';
import { signOut, updateNewsletterSubscription, updateProfileSettings } from '@/app/actions/profile';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import McpConnect from '@/components/McpConnect';
import PageIntro from '@/components/PageIntro';
import SubmitButton from '@/components/SubmitButton';
import WorkShell from '@/components/WorkShell';
import { onboardingQuestions, type OnboardingAnswers } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/server';
import { UserCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '에이전트 연결',
};

// Mirrors the tools registered in lib/mcp/server.ts.
const TOOLS = [
  ['search_opportunities', '만들고 싶은 것으로 검증된 기회 찾기'],
  ['get_opportunity', '원문과 경쟁 도구까지 한 번에'],
  ['generate_verified_prd', '원문이 붙은 PRD 만들기'],
  ['find_related_content', '관련 글과 오픈소스 찾기'],
];

function notice(status?: string) {
  if (status === 'saved') return '프로필이 저장되었습니다.';
  if (status === 'subscribed') return '주간 신호 구독을 신청했습니다.';
  if (status === 'unsubscribed') return '주간 신호 구독을 해지했습니다.';
  return null;
}

function formatAnswer(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '미설정';
  return value || '미설정';
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login');

  const [{ data: profile }, { data: onboarding }, params] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_onboarding').select('*').eq('user_id', user.id).maybeSingle(),
    searchParams,
  ]);

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? '';
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;
  const newsletterSubscribed = onboarding?.newsletter_subscribed ?? true;
  const onboardingAnswers = (onboarding?.answers ?? {}) as OnboardingAnswers;
  const statusNotice = notice(params.status);

  return (
    <>
      <Header />
      <WorkShell>
        <PageIntro title="에이전트 연결" description="Seedup은 MCP 서버로 동작합니다. Claude Code, Cursor 같은 코딩 에이전트가 검증된 PRD를 직접 가져갑니다." />

        {statusNotice && <p role="status" className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{statusNotice}</p>}

        <div className="flex max-w-[860px] flex-col gap-10">
          <McpConnect siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com'} />

          <section>
            <h2 className="text-[17px] font-semibold text-ink"><span className="num text-seed">3</span> 쓸 수 있는 도구</h2>
            <dl className="rows mt-3">
              {TOOLS.map(([name, detail]) => (
                <div key={name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
                  <dt className="font-mono text-sm text-ink">{name}</dt>
                  <dd className="text-[15px] text-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border-t border-outline-strong pt-8">
            <h2 className="text-xl font-bold tracking-tight text-ink">계정</h2>
            <form action={updateProfileSettings} className="mt-5">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-soft bg-surface-low">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={fullName || user.email || 'profile'} fill sizes="48px" className="object-cover" />
                  ) : (
                    <UserCircle aria-hidden="true" className="h-7 w-7 text-muted" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{fullName || '이름 없음'}</p>
                  <p className="truncate text-sm text-muted">{user.email} · Google 로그인</p>
                </div>
              </div>
              <label htmlFor="full_name" className="mt-5 block text-sm font-semibold text-ink">표시 이름</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input id="full_name" name="full_name" defaultValue={fullName} placeholder="이름을 입력하세요" className="h-11 min-w-0 flex-1 basis-56 border bg-white px-4 text-sm text-ink placeholder:text-muted focus:border-seed focus:outline-none" />
                <SubmitButton pendingText="저장 중" className="btn-quiet h-11">저장</SubmitButton>
              </div>
            </form>
          </section>

          <section className="border-t border-outline-soft pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-semibold text-ink">맞춤 추천 설정 <span className="text-sm font-normal text-muted">· {onboarding ? '설정 완료' : '설정 필요'}</span></h2>
              <Link href="/onboarding" className="link-seed">다시 설정하기 ›</Link>
            </div>
            <p className="mt-1 text-sm text-muted">관심 분야와 목표를 기준으로 오늘의 신호와 주간 신호를 맞춥니다.</p>
            <dl className="rows mt-4">
              {onboardingQuestions.map((question) => (
                <div key={question.id} className="grid gap-x-6 gap-y-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <dt className="text-muted">{question.title}</dt>
                  <dd className="text-ink">{formatAnswer(onboardingAnswers[question.id])}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-soft pt-8">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">주간 신호 메일 <span className="text-sm font-normal text-muted">· {newsletterSubscribed ? '구독 중' : '구독 안 함'}</span></h2>
              <p className="mt-1 text-sm text-muted">지켜보는 문제의 변화와 관심 분야 읽을거리를 매주 월요일에 받습니다.</p>
            </div>
            <form action={updateNewsletterSubscription}>
              <input type="hidden" name="subscribed" value={newsletterSubscribed ? 'false' : 'true'} />
              <SubmitButton pendingText={newsletterSubscribed ? '해지 중' : '신청 중'} className={newsletterSubscribed ? 'btn-quiet' : 'btn'}>{newsletterSubscribed ? '구독 해지' : '구독하기'}</SubmitButton>
            </form>
          </section>

          <form action={signOut} className="border-t border-outline-soft pt-6">
            <SubmitButton pendingText="로그아웃 중" className="inline-flex h-10 items-center gap-1.5 text-sm text-muted hover:text-red-700">로그아웃</SubmitButton>
          </form>
        </div>
      </WorkShell>
      <Footer />
    </>
  );
}
