import { runFullIngest, runManualIngest } from '@/app/actions/ingest';
import { sendManualNewsletter } from '@/app/actions/newsletter';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import SubmitButton from '@/components/SubmitButton';
import { getIngestQualitySummary, getIngestRejections, getIngestRuns } from '@/lib/data';
import { isAdminEmail } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';
import { Activity, CheckCircle2, Clock3, DatabaseZap, FileWarning, Mail, Play, ShieldCheck, XCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

const TASKS = [
  { key: 'rss', label: '뉴스/RSS 전처리', stage: 'collect', description: '기술 뉴스와 블로그 RSS를 파싱해 짧은 요약, 태그, 뉴스레터 메타데이터만 저장합니다. 긴 글은 만들지 않습니다.' },
  { key: 'products', label: 'AI 제품 전처리', stage: 'collect', description: 'Product Hunt 피드를 분석해 AI 제품 메타데이터와 뉴스레터 추천 필드를 저장합니다.' },
  { key: 'github', label: 'GitHub 전처리', stage: 'collect', description: '최근 업데이트된 오픈소스 저장소를 넓게 가져오고 stars 스냅샷, 7일 증가량, 마지막 확인일을 갱신합니다. 오래 안 보인 저장소는 정리합니다.' },
  { key: 'research', label: '논문/arXiv 전처리', stage: 'collect', description: '뉴스 RSS와 별개로 arXiv 논문을 수집하고 연구 요약, 구현 아이디어, 논문 추천 메타데이터를 저장합니다.' },
  { key: 'external-trends', label: '외부 트렌드 소스 수집', stage: 'collect', description: 'npm, Hugging Face, DEV.to, Stack Overflow, Product Hunt, Hacker News 공개 소스를 읽어 트렌드용 keyword_signals를 저장합니다.' },
  { key: 'trends', label: '트렌드 집계', stage: 'aggregate', description: '뉴스, AI 제품, GitHub, 논문 신호를 합쳐 카테고리별 Top 30 트렌드 랭킹과 7일 스냅샷을 갱신합니다.' },
  { key: 'project-ideas', label: '프로젝트 아이디어 생성', stage: 'generate', description: '전처리된 뉴스/제품/오픈소스 신호를 개별 포트폴리오 프로젝트로 변환합니다.' },
  { key: 'article-drafts', label: '데일리 아티클 생성', stage: 'generate', description: 'AI/LLM, 프론트엔드, 백엔드, 오픈소스/GitHub, 제품/빌드 아이디어, 논문/리서치 6개 트랙별 2개씩 하루 최대 12개 글을 생성합니다. 최소 3개 소스와 2개 소스 타입이 묶인 클러스터만 발행합니다.' },
  { key: 'deep-dive', label: '주간 Deep Dive 생성', stage: 'generate', description: '가장 강한 통합 클러스터를 바탕으로 긴 Deep Dive 글을 생성합니다. 주 1회만 실행하는 별도 발행 단계입니다.' },
] as const;

const STAGE_LABELS = {
  collect: '1. 데이터 수집/전처리',
  aggregate: '2. 신호 집계',
  generate: '3. 글/아이디어 생성',
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === 'success') return 'bg-white text-ink';
  if (status === 'partial') return 'bg-surface text-ink';
  return 'bg-ink text-white';
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
  const [runs, rejections, qualitySummary] = await Promise.all([getIngestRuns(), getIngestRejections(), getIngestQualitySummary()]);

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-12 md:px-10 md:py-16">
          <section className="flex flex-col gap-4 border-b border-outline-soft pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 border border-outline-soft bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
                <DatabaseZap className="h-4 w-4" />
                Ingestion Console
              </div>
              <h1 className="text-4xl font-black text-ink">데이터 수집 관리</h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted">뉴스 RSS와 논문/arXiv는 별도 수집 파이프라인입니다. 모든 소스는 먼저 전처리 데이터로 저장하고, 긴 글이나 Build Idea는 통합 글 생성 단계에서 별도로 만듭니다.</p>
            </div>
            <form action={runFullIngest}>
              <SubmitButton pendingText="전체 실행 중" className="inline-flex items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
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
                  : `수집 실행 요청에 실패했습니다.${params.reason ? ` 사유: ${params.reason}` : ' 환경 변수와 서버 로그를 확인하세요.'}`}
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-4">
            {[
              [`${qualitySummary.totalInserted}`, '최근 저장'],
              [`${qualitySummary.totalSkipped}`, '최근 스킵'],
              [`${qualitySummary.rejections}`, '제외 로그'],
              [`${qualitySummary.sources.length}`, '감시 소스'],
            ].map(([value, label]) => (
              <div key={label} className="border border-outline-soft bg-white p-5">
                <p className="text-3xl font-black text-ink">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
              </div>
            ))}
          </section>

          <section className="space-y-5">
            {(['collect', 'aggregate', 'generate'] as const).map((stage) => (
              <div key={stage} className="border border-outline-soft bg-white p-5">
                <div className="mb-4 flex flex-col gap-2 border-b border-outline-soft pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted">pipeline_stage</div>
                    <h2 className="mt-1 text-2xl font-black text-ink">{STAGE_LABELS[stage]}</h2>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-muted">
                    {stage === 'collect'
                      ? '여기서는 원천 데이터를 가져와 전처리 메타데이터만 저장합니다. 긴 글은 생성하지 않습니다.'
                      : stage === 'aggregate'
                        ? '전처리된 여러 소스의 키워드 신호를 모아 트렌드 기준을 갱신합니다.'
                        : '전처리·집계가 끝난 데이터를 묶어 프로젝트 아이디어나 발행용 초안을 만듭니다.'}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {TASKS.filter((task) => task.stage === stage).map((task) => (
                    <form key={task.key} action={runManualIngest} className="border border-outline-soft bg-surface-lowest p-5">
                      <input type="hidden" name="target" value={task.key} />
                      <h3 className="text-lg font-black text-ink">{task.label}</h3>
                      <p className="mt-2 min-h-20 text-sm leading-6 text-muted">{task.description}</p>
                      <SubmitButton pendingText="실행 중" className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-outline-soft bg-white px-4 py-2 text-sm font-bold text-ink hover:border-ink">
                        <Play className="h-4 w-4" />
                        실행
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="border border-outline-soft bg-white p-5 md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 border border-outline-soft bg-surface px-3 py-1 text-xs font-bold uppercase text-ink">
                  <Mail className="h-4 w-4" />
                  Manual Newsletter
                </div>
                <h2 className="text-2xl font-black text-ink">뉴스레터 수동 발송</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">뉴스, AI 제품, 오픈소스, 프로젝트 아이디어의 최신 데이터를 조합해 구독자에게 Seedup Weekly 이메일을 보냅니다.</p>
              </div>
              <form action={sendManualNewsletter}>
                <SubmitButton pendingText="발송 중" className="inline-flex w-full items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 md:w-auto">
                  <Mail className="h-4 w-4" />
                  뉴스레터 발송
                </SubmitButton>
              </form>
            </div>
          </section>

          <section className="border border-outline-soft bg-white">
            <div className="flex items-center gap-2 border-b border-outline-soft px-5 py-4">
              <ShieldCheck className="h-5 w-5 text-ink" />
              <h2 className="text-lg font-black text-ink">소스별 품질 디버그</h2>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {qualitySummary.sources.length ? qualitySummary.sources.map((source) => {
                const total = source.inserted + source.rejected + source.skipped;
                const acceptance = total ? Math.round((source.inserted / total) * 100) : 0;
                return (
                  <div key={source.source} className="border border-outline-soft bg-surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-black text-ink">{source.source}</h3>
                        <p className="mt-1 text-xs font-bold uppercase text-muted">acceptance {acceptance}%</p>
                      </div>
                      <span className="border border-outline-soft bg-white px-2 py-1 text-xs font-black text-ink">Q {source.quality || '-'}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                      {[
                        [source.inserted, '저장'],
                        [source.skipped, '스킵'],
                        [source.rejected, '제외'],
                        [source.duplicates, '중복'],
                      ].map(([value, label]) => (
                        <div key={label} className="border border-outline-soft bg-white p-2">
                          <p className="text-lg font-black text-ink">{value}</p>
                          <p className="text-[10px] font-bold uppercase text-muted">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }) : <EmptyState title="소스 품질 데이터가 없습니다" description="RSS 수집을 실행하면 소스별 저장/제외/중복 지표가 표시됩니다." />}
            </div>
          </section>

          <section className="border border-outline-soft bg-white">
            <div className="flex items-center gap-2 border-b border-outline-soft px-5 py-4">
              <FileWarning className="h-5 w-5 text-ink" />
              <h2 className="text-lg font-black text-ink">제외된 기사 로그</h2>
            </div>
            {!rejections.length ? (
              <div className="p-6">
                <EmptyState title="아직 제외 로그가 없습니다" description="키워드 미달, 관련도 미달, 요약 품질 미달로 제외된 기사가 여기에 기록됩니다." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-3">사유</th>
                      <th className="px-5 py-3">제목</th>
                      <th className="px-5 py-3">소스</th>
                      <th className="px-5 py-3">키워드</th>
                      <th className="px-5 py-3">점수</th>
                      <th className="px-5 py-3">시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-soft">
                    {rejections.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4">
                          <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-black text-ink">{item.reason}</span>
                        </td>
                        <td className="max-w-[360px] px-5 py-4">
                          {item.original_url ? (
                            <a href={item.original_url} target="_blank" rel="noreferrer" className="line-clamp-2 font-bold text-ink hover:underline">{item.title}</a>
                          ) : (
                            <span className="line-clamp-2 font-bold text-ink">{item.title}</span>
                          )}
                          {!!item.hard_excluded?.length && <p className="mt-1 text-xs font-bold text-muted">hard: {item.hard_excluded.join(', ')}</p>}
                          {!!item.soft_excluded?.length && <p className="mt-1 text-xs font-bold text-muted">soft: {item.soft_excluded.join(', ')}</p>}
                        </td>
                        <td className="px-5 py-4 font-semibold text-muted">{item.source}</td>
                        <td className="max-w-[220px] px-5 py-4 text-xs font-semibold text-muted">{item.matched_keywords?.slice(0, 5).join(', ') || '-'}</td>
                        <td className="px-5 py-4 text-xs font-bold text-muted">K {item.keyword_score ?? '-'} / AI {item.ai_score ?? '-'} / R {item.daily_rank_score ?? '-'}</td>
                        <td className="px-5 py-4 text-muted">{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="border border-outline-soft bg-white">
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
