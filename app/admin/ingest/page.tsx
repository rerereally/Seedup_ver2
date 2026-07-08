import { runFullIngest, runManualIngest } from '@/app/actions/ingest';
import { sendManualNewsletter } from '@/app/actions/newsletter';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import SubmitButton from '@/components/SubmitButton';
import { getIngestRuns } from '@/lib/data';
import { isAdminEmail } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';
import { Activity, CheckCircle2, Clock3, DatabaseZap, Mail, Play, XCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

const TASKS = [
  { key: 'rss', label: '뉴스 RSS 수집', description: '개발 뉴스 RSS를 파싱하고 AI 요약 후 news_items에 저장합니다.' },
  { key: 'products', label: 'AI 제품 수집', description: 'Product Hunt 피드를 분석해 ai_products에 저장합니다.' },
  { key: 'github', label: 'GitHub 트렌드 수집', description: '인기 저장소를 가져와 초보자용 리뷰와 프로젝트 아이디어를 만듭니다.' },
  { key: 'trends', label: '트렌드 집계', description: '누적 키워드 신호를 기반으로 trends와 trend_snapshots를 갱신합니다.' },
  { key: 'project-ideas', label: '프로젝트 아이디어 생성', description: '뉴스/제품/GitHub 신호를 포트폴리오 프로젝트로 변환합니다.' },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700';
  if (status === 'partial') return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function detailSummary(detail: Record<string, unknown> | null) {
  if (!detail) return '-';
  const pairs = Object.entries(detail)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
    .slice(0, 3);

  return pairs.length ? pairs.map(([key, value]) => `${key}: ${value}`).join(', ') : '-';
}

export default async function IngestAdminPage({ searchParams }: { searchParams: Promise<{ status?: string; target?: string; newsletter?: string; sent?: string; reason?: string }> }) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const params = await searchParams;
  const runs = await getIngestRuns();

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-12 md:px-10 md:py-16">
          <section className="flex flex-col gap-4 border-b border-outline-soft pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <DatabaseZap className="h-4 w-4" />
                Ingestion Console
              </div>
              <h1 className="text-4xl font-bold text-ink">데이터 수집 관리</h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted">로컬 개발과 초기 운영 단계에서 뉴스, 제품, GitHub, 트렌드, 프로젝트 아이디어 수집을 수동으로 실행하고 결과를 확인합니다.</p>
            </div>
            <form action={runFullIngest}>
              <SubmitButton pendingText="전체 실행 중" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                <Play className="h-4 w-4" />
                전체 순서대로 실행
              </SubmitButton>
            </form>
          </section>

          {(params.status || params.newsletter) && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${params.status === 'success' || params.newsletter === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {params.newsletter
                ? params.newsletter === 'success'
                  ? `뉴스레터 발송을 완료했습니다. 발송 대상: ${params.sent ?? 0}명`
                  : params.newsletter === 'no-recipients'
                    ? '뉴스레터 구독자가 없습니다.'
                    : `뉴스레터 발송에 실패했습니다.${params.reason ? ` 사유: ${params.reason}` : ' RESEND_API_KEY, NEWSLETTER_FROM_EMAIL, SUPABASE_SERVICE_ROLE_KEY를 확인하세요.'}`
                : params.status === 'success'
                  ? `${params.target ?? '수집'} 실행을 요청했습니다. 최근 실행 로그를 확인하세요.`
                  : '수집 실행 요청에 실패했습니다. 환경 변수와 서버 로그를 확인하세요.'}
            </div>
          )}

          <section className="grid gap-4 lg:grid-cols-5">
            {TASKS.map((task) => (
              <form key={task.key} action={runManualIngest} className="rounded-xl border border-outline-soft bg-white p-5">
                <input type="hidden" name="target" value={task.key} />
                <h2 className="text-lg font-semibold text-ink">{task.label}</h2>
                <p className="mt-2 min-h-16 text-sm leading-6 text-muted">{task.description}</p>
                <SubmitButton pendingText="실행 중" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-outline-soft bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                  <Play className="h-4 w-4" />
                  실행
                </SubmitButton>
              </form>
            ))}
          </section>

          <section className="rounded-xl border border-outline-soft bg-white p-5 md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                  <Mail className="h-4 w-4" />
                  Manual Newsletter
                </div>
                <h2 className="text-2xl font-semibold text-ink">뉴스레터 수동 발송</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">뉴스, AI 제품, GitHub 트렌드, 프로젝트 아이디어의 최신 데이터를 조합해 구독자에게 Seedup Weekly 이메일을 보냅니다.</p>
              </div>
              <form action={sendManualNewsletter}>
                <SubmitButton pendingText="발송 중" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:w-auto">
                  <Mail className="h-4 w-4" />
                  뉴스레터 발송
                </SubmitButton>
              </form>
            </div>
          </section>

          <section className="rounded-xl border border-outline-soft bg-white">
            <div className="flex items-center gap-2 border-b border-outline-soft px-5 py-4">
              <Activity className="h-5 w-5 text-brand-primary" />
              <h2 className="text-lg font-semibold text-ink">최근 실행 로그</h2>
            </div>
            {!runs.length ? (
              <div className="p-6">
                <EmptyState title="아직 실행 로그가 없습니다" description="위 버튼으로 수집을 실행하면 ingest_runs 테이블에 결과가 기록됩니다." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-3">상태</th>
                      <th className="px-5 py-3">수집</th>
                      <th className="px-5 py-3">저장</th>
                      <th className="px-5 py-3">스킵</th>
                      <th className="px-5 py-3">오류</th>
                      <th className="px-5 py-3">시간</th>
                      <th className="px-5 py-3">상세</th>
                      <th className="px-5 py-3">실행 시각</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-soft">
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(run.status)}`}>
                            {run.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            {run.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-ink">{run.source}</td>
                        <td className="px-5 py-4 text-muted">{run.inserted_count}</td>
                        <td className="px-5 py-4 text-muted">{run.skipped_count}</td>
                        <td className="px-5 py-4 text-muted">{run.error_count}</td>
                        <td className="px-5 py-4 text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {(run.duration_ms / 1000).toFixed(1)}s
                          </span>
                        </td>
                        <td className="max-w-[260px] truncate px-5 py-4 text-xs text-muted">{detailSummary(run.detail)}</td>
                        <td className="px-5 py-4 text-muted">{formatDate(run.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
