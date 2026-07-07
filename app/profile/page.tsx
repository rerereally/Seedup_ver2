import { signOut, updateNewsletterSubscription, updateProfileSettings } from '@/app/actions/profile';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import SubmitButton from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';
import { Bell, CheckCircle2, LogOut, Mail, Settings, UserCircle } from 'lucide-react';
import Image from 'next/image';
import { redirect } from 'next/navigation';

function notice(status?: string) {
  if (status === 'saved') return '프로필이 저장되었습니다.';
  if (status === 'subscribed') return '뉴스레터 구독을 신청했습니다.';
  if (status === 'unsubscribed') return '뉴스레터 구독을 해지했습니다.';
  return null;
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
  const statusNotice = notice(params.status);

  return (
    <>
      <Header />
      <main className="grow bg-surface-low">
        <div className="mx-auto max-w-[1040px] px-4 py-8 md:px-8 md:py-10">
          <section className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-outline-soft bg-white px-3 py-1 text-xs font-semibold text-brand-primary">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </div>
              <h1 className="text-3xl font-bold text-ink md:text-4xl">프로필 관리</h1>
              <p className="mt-2 text-sm leading-6 text-muted">계정 정보와 알림 설정을 관리합니다.</p>
            </div>
            <form action={signOut}>
              <SubmitButton pendingText="로그아웃 중" className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-soft bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                <LogOut className="h-4 w-4" />
                로그아웃
              </SubmitButton>
            </form>
          </section>

          {statusNotice && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {statusNotice}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-lg border border-outline-soft bg-white">
              <div className="border-b border-outline-soft px-5 py-4">
                <h2 className="text-lg font-semibold text-ink">기본 정보</h2>
              </div>
              <form action={updateProfileSettings} className="p-5">
                <div className="mb-6 flex items-center gap-4">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-soft bg-surface">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={fullName || user.email || 'profile'} fill sizes="56px" className="object-cover" />
                    ) : (
                      <UserCircle className="h-8 w-8 text-muted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{fullName || '이름 없음'}</div>
                    <div className="mt-1 truncate text-sm text-muted">{user.email}</div>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-ink">표시 이름</span>
                  <input
                    name="full_name"
                    defaultValue={fullName}
                    placeholder="이름을 입력하세요"
                    className="h-11 w-full rounded-lg border border-outline-soft bg-surface-low px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  />
                </label>

                <div className="mt-5 flex justify-end">
                  <SubmitButton pendingText="저장 중" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">
                    저장
                  </SubmitButton>
                </div>
              </form>
            </section>

            <aside className="flex flex-col gap-5">
              <section className="rounded-lg border border-outline-soft bg-white">
                <div className="border-b border-outline-soft px-5 py-4">
                  <h2 className="text-lg font-semibold text-ink">뉴스레터</h2>
                </div>
                <div className="p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{newsletterSubscribed ? '구독 중' : '구독 안 함'}</div>
                      <p className="mt-1 text-sm leading-6 text-muted">개발 트렌드, AI 제품, 이번 주 프로젝트 아이디어를 이메일로 받아봅니다.</p>
                    </div>
                  </div>

                  {newsletterSubscribed ? (
                    <form action={updateNewsletterSubscription}>
                      <input type="hidden" name="subscribed" value="false" />
                      <SubmitButton pendingText="해지 중" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-outline-soft bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                        구독 해지
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={updateNewsletterSubscription}>
                      <input type="hidden" name="subscribed" value="true" />
                      <SubmitButton pendingText="신청 중" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">
                        <Mail className="h-4 w-4" />
                        뉴스레터 신청
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-outline-soft bg-white p-5">
                <h2 className="text-lg font-semibold text-ink">계정 상태</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">로그인 방식</dt>
                    <dd className="font-semibold text-ink">Google OAuth</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">이메일</dt>
                    <dd className="max-w-[190px] truncate font-semibold text-ink">{user.email}</dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
