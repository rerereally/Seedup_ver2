import { latestEngineActors, summarizeSourceHealth } from '@/lib/ingest/health';
import type { SourceState } from '@/lib/ingest/health';
import type { Metadata } from 'next';
import { runFullIngest, runManualIngest } from '@/app/actions/ingest';
import { previewOpportunityDigestMail, sendOpportunityDigestMail } from '@/app/actions/opportunity-digest';
import { moderatePrdReport } from '@/app/actions/prd-report';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import SubmitButton from '@/components/SubmitButton';
import { getIngestQualitySummary, getIngestRejections, getIngestRuns, getRecommendationQuality } from '@/lib/data';
import { isAdminUser } from '@/lib/auth/admin';
import { pendingPrdReports } from '@/lib/db/prd-reports';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { prebuildDemoPrd, savePrdModelPolicy } from '@/app/actions/prd-models';
import { getOpportunities } from '@/lib/opportunities/data';
import { REPORT_REASONS } from '@/lib/opportunities/prd-report-input';
import { PRD_MAX_EVIDENCE, readPrdCache } from '@/lib/opportunities/prd-cache';
import { loadPrdPolicy, modelLabel, prdModels } from '@/lib/opportunities/models';
import { recentPrdRuns } from '@/lib/opportunities/prd-runs';
import { loadFunnelRows, recentFunnels } from '@/lib/metrics';
import { missingSchema, readApiSpec } from '@/lib/schema-check';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { digestSiteUrl, sendOpportunityDigest } from '@/lib/newsletter/opportunity-digest-send';
import { Activity, CheckCircle2, Clock3, DatabaseZap, Eye, FileWarning, Mail, Play, ShieldCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '수집 관리',
};

const TASKS = [
  { key: 'rss', label: '뉴스/RSS 전처리', stage: 'collect', description: '기술 뉴스와 블로그 RSS를 파싱해 짧은 요약, 태그, 뉴스레터 메타데이터만 저장합니다. 긴 글은 만들지 않습니다.' },
  { key: 'products', label: 'AI 제품 전처리', stage: 'collect', description: 'Product Hunt 피드를 분석해 AI 제품 메타데이터와 뉴스레터 추천 필드를 저장합니다.' },
  { key: 'github', label: 'GitHub 전처리', stage: 'collect', description: '최근 업데이트된 오픈소스 저장소를 넓게 가져오고 stars 스냅샷, 7일 증가량, 마지막 확인일을 갱신합니다. 오래 안 보인 저장소는 정리합니다.' },
  { key: 'research', label: '논문/arXiv 전처리', stage: 'collect', description: '뉴스 RSS와 별개로 arXiv 논문을 수집하고 연구 요약, 구현 아이디어, 논문 추천 메타데이터를 저장합니다.' },
  { key: 'external-trends', label: '외부 트렌드 소스 수집', stage: 'collect', description: 'npm, Hugging Face, DEV.to, Stack Overflow, Product Hunt, Hacker News 공개 소스를 읽어 트렌드용 keyword_signals를 저장합니다.' },
  { key: 'model-intelligence', label: 'OpenRouter 모델 인텔리전스', stage: 'collect', description: 'OpenRouter의 주간 사용량, 지능 지수, Design Arena 순위를 수집해 트렌드 페이지의 AI 모델 비교 데이터로 저장합니다.' },
  { key: 'embeddings', label: '평가 근거 임베딩', stage: 'aggregate', description: '아직 임베딩이 없는 뉴스·제품·저장소·논문·프로젝트를 벡터로 바꿔, 아이디어 평가가 새 콘텐츠를 근거로 찾을 수 있게 합니다. 한 번에 최대 60개씩 채웁니다.' },
  { key: 'trends', label: '트렌드 집계', stage: 'aggregate', description: '뉴스, AI 제품, GitHub, 논문 신호를 합쳐 카테고리별 Top 30 트렌드 랭킹과 7일 스냅샷을 갱신합니다.' },
  { key: 'project-ideas', label: '프로젝트 아이디어 생성', stage: 'generate', description: '전처리된 뉴스/제품/오픈소스 신호를 개별 포트폴리오 프로젝트로 변환합니다.' },
  { key: 'article-drafts', label: '데일리 아티클 생성', stage: 'generate', description: '최신 데이터가 있는 트랙부터 한 번에 최대 12개를 생성합니다. 트랙별 고정 개수 제한은 없으며, 최소 3개 소스와 2개 소스 타입이 묶인 클러스터를 우선 발행하고 중복 글은 차단합니다.' },
  { key: 'deep-dive', label: '주간 Deep Dive 생성', stage: 'generate', description: '가장 강한 통합 클러스터를 바탕으로 긴 Deep Dive 글을 생성합니다. 주 1회만 실행하는 별도 발행 단계입니다.' },
] as const;

const STAGE_LABELS = {
  collect: '1. 데이터 수집/전처리',
  aggregate: '2. 신호 집계',
  generate: '3. 글/아이디어 생성',
} as const;

const HEALTH_LABELS: Record<SourceState, string> = { ok: '정상', unstable: '불안정', failing: '연속 실패', stale: '이틀 넘게 성공 없음' };

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
  const priorityKeys = ['reason', 'skip_reasons', 'remaining_daily_slots', 'sources', 'clusters', 'selected', 'upserted'];
  const entries = Object.entries(detail);
  const pairs = [...priorityKeys.map((key) => entries.find(([entryKey]) => entryKey === key)).filter(Boolean) as Array<[string, unknown]>, ...entries]
    .filter((pair, index, all) => pair && all.findIndex(([key]) => key === pair[0]) === index)
    .flatMap(([key, value]) => {
      if (typeof value === 'number' || typeof value === 'string') return [[key, value] as [string, string | number]];
      if (key === 'skip_reasons' && Array.isArray(value) && value.length) return [[key, value.slice(0, 2).join(' | ')] as [string, string]];
      return [];
    })
    .slice(0, 3);

  return pairs.length ? pairs.map(([key, value]) => `${key}: ${value}`).join(', ') : '-';
}

const DIGEST_SKIP_MESSAGES: Record<string, string> = {
  empty: '보낼 변화가 없습니다. 최근 기간 안에 달라진 기회가 없습니다.',
  'not-configured': '발송 설정이 없어 메일을 보내지 않았습니다. RESEND_API_KEY, NEWSLETTER_FROM_EMAIL, SUPABASE_SECRET_KEY와 https SEEDUP_SITE_URL을 확인하세요.',
  error: '다이제스트 발송 중 오류가 발생했습니다. 서버 로그를 확인하세요.',
};

// For showing costs in won; an estimate, not an exchange-rate feed.
const KRW_PER_USD = 1_400;

export default async function IngestAdminPage({ searchParams }: { searchParams: Promise<{ status?: string; target?: string; newsletter?: string; sent?: string; reason?: string; digest?: string; kind?: string; duplicates?: string; failed?: string; prdModels?: string; demo?: string; prdReport?: string }> }) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  // Anyone who is not an admin, signed in or not, gets the same 404 as a page that does not exist.
  if (!isAdminUser(data.user)) notFound();

  const params = await searchParams;
  const service = createAdminClient();
  const [allRuns, rejections, qualitySummary, recommendationQuality, prdPolicy, prdRuns, funnelRows, apiSpec, reports, lang] = await Promise.all([getIngestRuns(200), getIngestRejections(), getIngestQualitySummary(), getRecommendationQuality(), loadPrdPolicy(service), recentPrdRuns(service), loadFunnelRows(service), readApiSpec(), pendingPrdReports(), getLang()]);
  const t = translator(lang);
  const funnels = recentFunnels(funnelRows);
  const schemaGaps = apiSpec ? missingSchema(apiSpec) : null;
  const prdMenu = prdModels(prdPolicy);
  // The verified problems a demo is likely to open, and whether each already has a saved PRD.
  const { opportunities: allOpportunities } = await getOpportunities();
  const demoRows = await Promise.all(allOpportunities.filter((item) => item.qualified).slice(0, 12).map(async (item) => ({
    item,
    saved: await readPrdCache(service, item.evidence.slice(0, PRD_MAX_EVIDENCE).map((row) => row.id)),
  })));
  const enabledIds = new Set(prdPolicy.enabled);
  // Per account over the rows shown, so a heavy user stands out at a glance.
  const prdByAccount = [...prdRuns.reduce((map, row) => {
    const key = row.email ?? '(이메일 없음)';
    const total = map.get(key) ?? { runs: 0, cost: 0 };
    map.set(key, { runs: total.runs + 1, cost: total.cost + Number(row.cost_usd) });
    return map;
  }, new Map<string, { runs: number; cost: number }>())].sort((a, b) => b[1].cost - a[1].cost || b[1].runs - a[1].runs);
  const won = (usd: number) => `${Math.round(usd * KRW_PER_USD).toLocaleString('ko-KR')}원`;
  const runs = allRuns.slice(0, 30);
  const health = summarizeSourceHealth(allRuns);
  const actors = latestEngineActors(allRuns);
  const digestKind = params.kind === 'weekly' ? 'weekly' : 'changes';
  // Preview is a dry run, so this renders the mail on the page without sending anything.
  const digestPreview = params.digest === 'preview'
    ? await sendOpportunityDigest({ service: createAdminClient(), kind: digestKind, dryRun: true, siteUrl: digestSiteUrl() })
    : null;
  const digestMessage = params.digest === 'sent'
    ? `기회 다이제스트 발송을 완료했습니다. 발송 ${params.sent ?? 0}명, 이미 발송 ${params.duplicates ?? 0}명, 실패 ${params.failed ?? 0}명`
    : params.digest === 'skipped'
      ? DIGEST_SKIP_MESSAGES[params.reason ?? ''] ?? '다이제스트를 보내지 않았습니다.'
      : null;

  return (
    <>
      <Header />
      <main id="main-content" className="grow bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-12 md:px-10 md:py-16">
          <section className="flex flex-col gap-4 border-b border-outline-soft pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 border border-outline-soft bg-white px-3 py-1 text-xs font-bold uppercase text-ink">
                <DatabaseZap className="h-4 w-4" />
                Ingestion Console
              </div>
              <h1 className="text-4xl font-bold text-ink">데이터 수집 관리</h1>
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
                  ? `뉴스레터 발송을 완료했습니다. 발송 ${params.sent ?? 0}명, 중복 건너뜀 ${params.duplicates ?? 0}명, 실패 ${params.failed ?? 0}명`
                  : params.newsletter === 'no-recipients'
                    ? '뉴스레터 구독자가 없습니다.'
                    : `뉴스레터 발송에 실패했습니다.${params.reason ? ` 사유: ${params.reason}` : ' RESEND_API_KEY, NEWSLETTER_FROM_EMAIL, SUPABASE_SECRET_KEY를 확인하세요.'}`
                : params.status === 'success'
                  ? `${params.target === 'all' ? '전체 수집' : params.target ?? '수집'} 실행을 요청했습니다. 최근 실행 로그를 확인하세요.`
                  : params.target === 'all' && params.status === 'failed'
                    ? `전체 수집 중 다음 단계가 실패했습니다: ${params.reason ?? '알 수 없음'}. 최근 실행 로그를 확인하세요.`
                    : `수집 실행 요청에 실패했습니다.${params.reason ? ` 사유: ${params.reason}` : ' 환경 변수와 서버 로그를 확인하세요.'}`}
            </div>
          )}

          <section id="prd-reports" className="scroll-mt-20 border border-outline-soft bg-white p-5 md:p-6" aria-labelledby="prd-reports-heading">
            <h2 id="prd-reports-heading" className="text-2xl font-bold text-ink">{t('공개 PRD 신고', 'Public PRD reports')}</h2>
            {params.prdReport && <p className="mt-2 text-sm" role="status">{
              params.prdReport === 'removed' ? t('공개 목록에서 내렸습니다.', 'Removed from the public list.')
                : params.prdReport === 'ignored' ? t('이 신고를 무시했습니다.', 'Dismissed this report.')
                  : t('신고 상태를 바꾸지 못했습니다. 목록을 확인해 주세요.', 'Could not update the report. Check the list.')
            }</p>}
            {reports.length ? (
              <ul className="mt-3 divide-y divide-outline-soft">
                {reports.map((report) => (
                  <li key={report.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 break-words text-sm">
                      {report.evidence_dossiers?.shared
                        ? <Link className="link-seed font-semibold" href={`/spec/${report.dossier_id}`}>{report.evidence_dossiers.title}</Link>
                        : <p className="font-semibold">{report.evidence_dossiers?.title ?? t('공유가 종료된 PRD', 'PRD no longer shared')}</p>}
                      <p className="mt-1">{t(REPORT_REASONS[report.reason][0], REPORT_REASONS[report.reason][1])} · {report.note}</p>
                      <time className="text-muted" dateTime={report.created_at}>{formatDate(report.created_at)}</time>
                    </div>
                    <form action={moderatePrdReport} className="flex shrink-0 flex-wrap gap-2">
                      <input name="id" type="hidden" value={report.id} />
                      <button type="submit" name="status" value="removed" className="btn-quiet h-9">{t('목록에서 내리기', 'Remove from list')}</button>
                      <button type="submit" name="status" value="ignored" className="btn-quiet h-9">{t('신고 무시', 'Dismiss report')}</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">{t('처리할 신고가 없습니다.', 'No reports to review.')}</p>}
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {[
              [`${qualitySummary.totalInserted}`, '최근 저장'],
              [`${qualitySummary.totalSkipped}`, '최근 스킵'],
              [`${qualitySummary.rejections}`, '제외 로그'],
              [`${qualitySummary.sources.length}`, '감시 소스'],
            ].map(([value, label]) => (
              <div key={label} className="border border-outline-soft bg-white p-5">
                <p className="text-3xl font-bold text-ink">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {[
              [recommendationQuality.impressions, '추천 노출'],
              [recommendationQuality.clicks, '추천 클릭'],
              [`${recommendationQuality.clickRate}%`, '추천 클릭률'],
              [recommendationQuality.useful, '유용 피드백'],
            ].map(([value, label]) => (
              <div key={label} className="border border-outline-soft bg-white p-5">
                <p className="text-3xl font-bold text-ink">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
              </div>
            ))}
          </section>

          <section className="border border-outline-soft bg-white p-5 md:p-6" aria-labelledby="usage-heading">
            <h2 id="usage-heading" className="text-2xl font-bold text-ink">사용 지표</h2>
            <p className="mt-1 text-sm text-muted">사이트가 이미 쓰는 표(가입, 킵, PRD 실행, 저장, 에이전트 토큰, 하루 사용량)에서 센 사람 수입니다. 로그인하지 않은 방문은 세지 않습니다.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-muted">
                  <tr><th className="py-2 pr-4 font-medium">기간</th>{['가입', '활동', '다시 옴', '킵', 'PRD 만듦', 'PRD 저장', '에이전트 사용', 'PRD 성공률', 'PRD 중간 시간'].map((name) => <th key={name} className="py-2 pr-4 font-medium">{name}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-outline-soft">
                  {funnels.map(({ label, funnel }) => (
                    <tr key={label} className="num">
                      <td className="py-2 pr-4 font-semibold text-ink">{label}</td>
                      {[funnel.signedUp, funnel.active, funnel.returning, funnel.kept, funnel.prdMade, funnel.prdSaved, funnel.agentUsed].map((value, index) => <td key={index} className="py-2 pr-4">{value}</td>)}
                      <td className="py-2 pr-4">{funnel.prdSuccessRate === null ? '-' : `${funnel.prdSuccessRate}% (${funnel.prdRuns}건)`}</td>
                      <td className="py-2 pr-4">{funnel.prdMedianSeconds === null ? '-' : `${funnel.prdMedianSeconds}초`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">에이전트를 연결한 계정은 모두 {funnels[1].funnel.agentConnected}개입니다. 목표: PRD 성공률 95% 이상, 절반이 40초 안에 끝남.</p>
          </section>

          <section className="border border-outline-soft bg-white p-5 md:p-6" aria-labelledby="schema-heading">
            <h2 id="schema-heading" className="text-2xl font-bold text-ink">DB 변경 확인</h2>
            {schemaGaps === null ? (
              <p className="mt-2 text-sm text-muted">DB 구조 설명을 읽지 못해 확인하지 못했습니다.</p>
            ) : schemaGaps.length ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {schemaGaps.map((gap) => <li key={gap.file} className="text-red-700"><code className="font-mono">supabase/migrations/{gap.file}</code>를 적용하세요(npx supabase db push 또는 SQL 편집기). 빠진 것: {gap.missing.join(', ')}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">supabase/migrations의 변경이 모두 적용되어 있습니다.</p>
            )}
          </section>

          <section className="space-y-5">
            {(['collect', 'aggregate', 'generate'] as const).map((stage) => (
              <div key={stage} className="border border-outline-soft bg-white p-5">
                <div className="mb-4 flex flex-col gap-2 border-b border-outline-soft pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted">pipeline_stage</div>
                    <h2 className="mt-1 text-2xl font-bold text-ink">{STAGE_LABELS[stage]}</h2>
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
                      <h3 className="text-lg font-bold text-ink">{task.label}</h3>
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

          <section id="prd-models" className="scroll-mt-24 border border-outline-soft bg-white p-5 md:p-6">
            <h2 className="text-2xl font-bold text-ink">PRD 모델</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">모든 계정이 PRD를 만들 때 고를 수 있는 모델입니다. 체크를 끄면 그 모델을 고른 요청도 무료 모델로 만들어집니다. 수집·처리 엔진은 이 설정과 관계없이 항상 무료 모델만 씁니다. 저장 후 30초 안에 반영됩니다.</p>
            {params.prdModels && (
              <p className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${params.prdModels === 'saved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {params.prdModels === 'saved' ? '저장했습니다.' : params.prdModels === 'missing-service-key' ? '서버 키가 없어 저장하지 못했습니다.' : '저장하지 못했습니다. supabase/migrations/20261117111335_prd_models.sql을 실행했는지 확인하세요.'}
              </p>
            )}
            <form action={savePrdModelPolicy} className="mt-5">
              <ul className="divide-y divide-outline-soft border-y border-outline-soft">
                {prdMenu.map((row, index) => (
                  <li key={row.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2.5 text-sm">
                      <input type="checkbox" name="enabled" value={row.id} defaultChecked={index === 0 || enabledIds.has(row.id)} disabled={index === 0} className="h-4 w-4 accent-seed" />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-ink">{row.label}</span>
                        <span className="ml-2 text-muted">{row.note}</span>
                        {index === 0 && <span className="ml-2 text-muted">항상 켜짐</span>}
                        {row.reason === 'EXAONE 키가 아직 없음' && <span className="ml-2 text-red-700">EXAONE_API_KEY가 없어 켜도 쓸 수 없음</span>}
                      </span>
                      <code className="hidden text-xs text-muted md:inline">{row.id}</code>
                    </label>
                  </li>
                ))}
              </ul>
              <SubmitButton pendingText="저장 중" className="mt-4 inline-flex items-center justify-center bg-ink px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">저장</SubmitButton>
            </form>

            <h3 id="demo-prds" className="mt-10 scroll-mt-24 text-lg font-bold text-ink">시연용 PRD 미리 만들기</h3>
            <p className="mt-1 text-sm text-muted">기준을 통과한 문제의 PRD를 미리 만들어 저장합니다. 저장된 PRD는 로그인 없이도 바로 열리므로 시연 중에 모델을 기다리지 않습니다. 한 번에 한 문제씩, 최대 1분 30초 걸립니다.</p>
            {params.demo && <p className={`mt-3 text-sm font-semibold ${params.demo === 'saved' ? 'text-emerald-700' : 'text-red-700'}`}>{params.demo === 'saved' ? 'PRD를 만들어 저장했습니다.' : params.demo === 'failed' ? '모델이 답하지 않았습니다. 다른 모델로 다시 시도해 보세요.' : '만들지 못했습니다.'}</p>}
            <ul className="mt-4 divide-y divide-outline-soft border-y border-outline-soft">
              {demoRows.map(({ item, saved }) => (
                <li key={item.slug} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <a href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="font-semibold text-ink underline-offset-4 hover:underline">{item.name}</a>
                    <span className={`ml-2 ${saved ? 'text-emerald-700' : 'text-muted'}`}>{saved ? `저장됨, ${new Date(saved.createdAt).toLocaleDateString('ko-KR')}` : '아직 없음'}</span>
                  </span>
                  <form action={prebuildDemoPrd} className="flex items-center gap-2">
                    <input type="hidden" name="slug" value={item.slug} />
                    <select name="model" defaultValue={prdMenu.find((row) => row.available && !row.free)?.id ?? prdMenu[0]?.id} className="border border-outline-soft bg-white px-2 py-1.5 text-sm text-ink" aria-label={`${item.name} PRD 모델`}>
                      {prdMenu.filter((row) => row.available).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                    </select>
                    <SubmitButton pendingText="만드는 중" className="border border-outline-strong bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-low">{saved ? '다시 만들기' : '만들기'}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>

            <h3 className="mt-10 text-lg font-bold text-ink">PRD 사용 기록</h3>
            <p className="mt-1 text-sm text-muted">최근 {prdRuns.length}건. 비용은 모델이 알려 준 토큰 수에 OpenRouter 가격을 곱한 추정치입니다(1달러 = {KRW_PER_USD.toLocaleString('ko-KR')}원으로 계산).</p>
            {prdRuns.length ? (
              <>
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {prdByAccount.slice(0, 8).map(([email, total]) => (
                    <li key={email}><span className="font-semibold text-ink">{email}</span> <span className="text-muted">{total.runs}건, {won(total.cost)}</span></li>
                  ))}
                </ul>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-outline-soft text-xs text-muted">
                      <tr><th className="py-2 pr-4 font-medium">시간</th><th className="py-2 pr-4 font-medium">계정</th><th className="py-2 pr-4 font-medium">종류</th><th className="py-2 pr-4 font-medium">모델</th><th className="py-2 pr-4 font-medium">제목</th><th className="py-2 pr-4 font-medium">결과</th><th className="py-2 pr-4 text-right font-medium">토큰</th><th className="py-2 text-right font-medium">비용</th></tr>
                    </thead>
                    <tbody className="divide-y divide-outline-soft">
                      {prdRuns.map((row) => (
                        <tr key={`${row.created_at}-${row.email}-${row.kind}`}>
                          <td className="whitespace-nowrap py-2 pr-4 text-muted">{new Date(row.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 pr-4">{row.email ?? '-'}</td>
                          <td className="py-2 pr-4">{{ prd: '생성', revise: '수정', slots: '개발 준비' }[row.kind] ?? row.kind}</td>
                          <td className="py-2 pr-4">{modelLabel(row.model)}{row.requested_model !== row.model && row.requested_model !== 'default' && <span className="block text-xs text-muted">요청: {modelLabel(row.requested_model)}</span>}</td>
                          <td className="max-w-[16rem] truncate py-2 pr-4" title={row.title}>{row.title}</td>
                          <td className={`py-2 pr-4 ${row.ok ? 'text-emerald-700' : 'text-red-700'}`}>{row.ok ? '성공' : '실패'}<span className="ml-1 text-xs text-muted">{Math.round(row.duration_ms / 1000)}초</span></td>
                          <td className="py-2 pr-4 text-right tabular-nums text-muted">{(row.prompt_tokens + row.completion_tokens).toLocaleString('ko-KR')}</td>
                          <td className="py-2 text-right tabular-nums">{won(Number(row.cost_usd))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">아직 기록이 없습니다. supabase/migrations/20261117111335_prd_models.sql을 실행한 뒤부터 쌓입니다.</p>
            )}
          </section>

          <section className="border border-outline-soft bg-white p-5 md:p-6">
            <div className="mb-2 inline-flex items-center gap-2 border border-outline-soft bg-surface px-3 py-1 text-xs font-bold uppercase text-ink">
              <Mail className="h-4 w-4" />
              Opportunity Digest
            </div>
            <h2 className="text-2xl font-bold text-ink">기회 다이제스트</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">기회 변동 알림, 또는 기회와 맞춤 읽을거리를 담은 주간 신호를 확인하고 구독자에게 보냅니다. 주간 신호는 보낼 때 지난 호 보관함에도 저장됩니다. 미리보기는 아무것도 보내지 않습니다.</p>
            {digestMessage && (
              <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${params.digest === 'sent' && Number(params.failed ?? 0) === 0 ?'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {digestMessage}
              </div>
            )}
            <form className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                종류
                <select name="kind" defaultValue={digestKind} className="border border-outline-soft bg-white px-3 py-2 text-sm font-semibold text-ink">
                  <option value="changes">변동 알림</option>
                  <option value="weekly">주간 요약</option>
                </select>
              </label>
              <button type="submit" formAction={previewOpportunityDigestMail} className="inline-flex items-center justify-center gap-2 border border-outline-soft bg-white px-5 py-3 text-sm font-bold text-ink hover:border-ink">
                <Eye className="h-4 w-4" />
                미리보기
              </button>
              <button type="submit" formAction={sendOpportunityDigestMail} className="inline-flex items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
                <Mail className="h-4 w-4" />
                발송
              </button>
            </form>
            {digestPreview && (
              <div className="mt-5">
                {digestPreview.status === 'preview' ? (
                  <>
                    <p className="text-sm font-bold text-ink">제목: {digestPreview.subject}</p>
                    <pre className="mt-2 whitespace-pre-wrap border border-outline-soft bg-surface p-4 text-sm leading-6 text-ink">{digestPreview.text}</pre>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-muted">{DIGEST_SKIP_MESSAGES.empty}</p>
                )}
              </div>
            )}
          </section>

          <section className="border border-outline-soft bg-white">
            <div className="flex items-center gap-2 border-b border-outline-soft px-5 py-4">
              <ShieldCheck className="h-5 w-5 text-ink" />
              <h2 className="text-lg font-bold text-ink">소스별 품질 디버그</h2>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {qualitySummary.sources.length ? qualitySummary.sources.map((source) => {
                const total = source.inserted + source.rejected + source.skipped;
                const acceptance = total ? Math.round((source.inserted / total) * 100) : 0;
                return (
                  <div key={source.source} className="border border-outline-soft bg-surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-ink">{source.source}</h3>
                        <p className="mt-1 text-xs font-bold uppercase text-muted">acceptance {acceptance}%</p>
                      </div>
                      <span className="border border-outline-soft bg-white px-2 py-1 text-xs font-bold text-ink">Q {source.quality || '-'}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                      {[
                        [source.fetched, '가져옴'],
                        [source.recent, '최근'],
                        [source.inserted, '저장'],
                        [source.skipped, '스킵'],
                        [source.rejected, '제외'],
                        [source.duplicates, '중복'],
                      ].map(([value, label]) => (
                        <div key={label} className="border border-outline-soft bg-white p-2">
                          <p className="text-lg font-bold text-ink">{value}</p>
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
              <h2 className="text-lg font-bold text-ink">제외된 기사 로그</h2>
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
                          <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-ink">{item.reason}</span>
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

          <section className="border border-outline-soft bg-white" aria-labelledby="health-heading">
            <div className="border-b border-outline-soft px-5 py-4">
              <h2 id="health-heading" className="text-lg font-semibold text-ink">소스 상태</h2>
              <p className="mt-1 text-sm text-muted">최근 실행 {allRuns.length}건을 소스별로 묶었습니다. 문제가 있는 소스가 위에 옵니다.</p>
            </div>
            {!health.length ? (
              <p className="p-6 text-sm text-muted">아직 실행 기록이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-surface text-xs text-muted">
                    <tr>
                      <th className="px-5 py-3">소스</th>
                      <th className="px-5 py-3">상태</th>
                      <th className="px-5 py-3">실패 / 실행</th>
                      <th className="px-5 py-3">마지막 실행</th>
                      <th className="px-5 py-3">마지막 성공</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.map((row) => (
                      <tr key={row.source} className="border-t border-outline-soft">
                        <td className="px-5 py-3 font-semibold text-ink">{row.source}</td>
                        <td className="px-5 py-3"><span className={`inline-block border border-outline-soft px-2 py-1 text-xs font-bold ${row.state === 'ok' ? 'bg-white text-ink' : row.state === 'unstable' ? 'bg-surface text-ink' : 'bg-ink text-white'}`}>{HEALTH_LABELS[row.state]}</span></td>
                        <td className="num px-5 py-3 text-muted">{row.failures} / {row.runs}</td>
                        <td className="px-5 py-3 text-muted">{formatDate(row.lastRunAt)}</td>
                        <td className="px-5 py-3 text-muted">{row.lastSuccessAt ? formatDate(row.lastSuccessAt) : '없음'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {actors.length > 0 && (
              <div className="border-t border-outline-soft px-5 py-4">
                <h3 className="text-sm font-bold text-ink">기회 엔진의 마지막 수집</h3>
                <ul className="mt-2 grid gap-x-8 gap-y-1 text-sm text-muted sm:grid-cols-2">
                  {actors.map((actor) => (
                    <li key={actor.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{actor.id}</span>
                      <span className="num shrink-0"><span className="text-ink">{actor.items}</span>건{actor.errors ? `, 오류 ${actor.errors}` : ''}{actor.status !== 'ok' ? ` (${actor.status === 'failed' ? '실패' : '일부'})` : ''}</span>
                    </li>
                  ))}
                </ul>
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
