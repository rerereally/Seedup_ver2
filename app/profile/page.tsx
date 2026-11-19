import type { Metadata } from 'next';
import { signOut, updateNewsletterSubscription, updateNotifyWebhook, updateProfileSettings } from '@/app/actions/profile';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import IdeaPages from '@/components/IdeaPages';
import IdeaWatches from '@/components/IdeaWatches';
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
  title: '설정',
};

function notice(status?: string) {
  if (status === 'saved') return '프로필이 저장되었습니다.';
  if (status === 'subscribed') return '주간 신호 구독을 신청했습니다.';
  if (status === 'unsubscribed') return '주간 신호 구독을 해지했습니다.';
  if (status === 'webhook-saved') return '채팅 알림을 저장했습니다. 다음 알림부터 그 채널로도 갑니다.';
  if (status === 'webhook-cleared') return '채팅 알림을 껐습니다.';
  if (status === 'webhook-invalid') return '디스코드나 슬랙의 웹훅 주소만 넣을 수 있습니다.';
  if (status === 'webhook-failed') return '채팅 알림을 저장하지 못했습니다. DB 설정(20261118121507_notify_webhook.sql)을 확인하세요.';
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
        <PageIntro title="설정" description="계정, 맞춤 추천, 알림, 그리고 내가 만든 아이디어 소개 페이지와 지켜보는 아이디어를 관리합니다." aside={<Link href="/agents" className="btn-quiet h-10 px-4 text-sm">MCP 연동 (코딩 에이전트 연결)</Link>} />

        {statusNotice && <p role="status" className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{statusNotice}</p>}

        <div className="flex max-w-[860px] flex-col gap-10">
          <section id="idea-pages" className="scroll-mt-6">
            <h2 className="text-[17px] font-semibold text-ink">아이디어 소개 페이지</h2>
            <p className="mt-2 text-[15px] text-muted">만들기 전에 아이디어를 소개하는 페이지와 대기자 명단을 만들어, 실제로 신청하는 사람이 있는지 셉니다. 신청한 이메일은 나에게만 보입니다.</p>
            <IdeaPages />
            <h2 className="mt-10 text-[17px] font-semibold text-ink">지켜보는 아이디어</h2>
            <p className="mt-2 text-[15px] text-muted">매주 한 번 다시 찾아보고, 새 원문이나 경쟁 도구가 생기면 메일로 알려 드립니다.</p>
            <IdeaWatches />
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
                  <p className="truncate text-sm text-muted">{user.email}, Google 로그인</p>
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
              <h2 className="text-[17px] font-semibold text-ink">맞춤 추천 설정 <span className="text-sm font-normal text-muted">{onboarding ? '설정 완료' : '설정 필요'}</span></h2>
              <Link href="/onboarding" className="link-seed">다시 설정하기</Link>
            </div>
            <p className="mt-1 text-sm text-muted">관심 분야와 목표를 기준으로 인사이트와 주간 신호를 맞춥니다.</p>
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
              <h2 className="text-[17px] font-semibold text-ink">주간 신호 메일 <span className="text-sm font-normal text-muted">{newsletterSubscribed ? '구독 중' : '구독 안 함'}</span></h2>
              <p className="mt-1 text-sm text-muted">지켜보는 문제의 변화와 관심 분야 읽을거리를 매주 월요일에 받습니다.</p>
            </div>
            <form action={updateNewsletterSubscription}>
              <input type="hidden" name="subscribed" value={newsletterSubscribed ? 'false' : 'true'} />
              <SubmitButton pendingText={newsletterSubscribed ? '해지 중' : '신청 중'} className={newsletterSubscribed ? 'btn-quiet' : 'btn'}>{newsletterSubscribed ? '구독 해지' : '구독하기'}</SubmitButton>
            </form>
          </section>

          <section className="border-t border-outline-soft pt-8">
            <h2 className="text-[17px] font-semibold text-ink">디스코드, 슬랙 알림 <span className="text-sm font-normal text-muted">· {onboarding?.notify_webhook ? '켜짐' : '꺼짐'}</span></h2>
            <p className="mt-1 text-sm text-muted">채널의 웹훅 주소를 넣으면 주간 신호와 변경 알림을 그 채널로도 보냅니다. 비우고 저장하면 꺼집니다.</p>
            <form action={updateNotifyWebhook} className="mt-3 flex flex-wrap gap-2">
              <input name="webhook" type="url" defaultValue={onboarding?.notify_webhook ?? ''} placeholder="https://discord.com/api/webhooks/... 또는 https://hooks.slack.com/services/..." className="h-11 min-w-0 flex-1 basis-[22rem] rounded-lg border border-field bg-white px-3 text-[14px]" />
              <SubmitButton pendingText="저장 중" className="btn-quiet h-11">저장</SubmitButton>
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
