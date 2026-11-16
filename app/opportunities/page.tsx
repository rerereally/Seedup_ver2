import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import OpportunityTable from '@/components/opportunity-stage/OpportunityTable';
import { getOpportunities } from '@/lib/opportunities/data';
import { trackRecord, trackRecordSummary } from '@/lib/opportunities/insight';
import { getLang } from '@/lib/i18n-server';
import { translator } from '@/lib/i18n';
import { MIN_EVIDENCE, MIN_PLATFORMS } from '@/lib/opportunities/types';

export const metadata: Metadata = {
  title: '기회',
  description: '개발자들의 실제 불만과 이미 있는 도구를 대조해 찾은 제품 기회입니다.',
};

const PAGE_SIZE = 12;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; all?: string }> }) {
  const { stage, q, all } = await searchParams;
  const { opportunities, generatedAt } = await getOpportunities();
  const lang = await getLang();
  const t = translator(lang);
  const query = q?.trim().toLowerCase() ?? '';
  const verified = opportunities.filter((item) => item.qualified).length;
  // shortcut: plain keyword match on name, problem and keywords; switch to /api/opportunities/match when meaning-based search is needed here.
  const matched = query
    ? opportunities.filter((item) => [item.name, item.problem, item.nameEn, item.problemEn, ...item.keywords].some((value) => value?.toLowerCase().includes(query)))
    : opportunities;
  const filtered = stage === 'verified' ? matched.filter((item) => item.qualified) : stage === 'gathering' ? matched.filter((item) => !item.qualified) : matched;
  // Verified problems first, then the ones closest to the bar.
  const sorted = [...filtered].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length);
  const visible = all ? sorted : sorted.slice(0, PAGE_SIZE);
  const href = (next: { stage?: string; all?: boolean }) => {
    const params = new URLSearchParams();
    if (next.stage) params.set('stage', next.stage);
    if (q?.trim()) params.set('q', q.trim());
    if (next.all) params.set('all', '1');
    const search = params.toString();
    return `/opportunities${search ? `?${search}` : ''}`;
  };
  const record = trackRecord(opportunities);
  const summary = trackRecordSummary(record, opportunities.length);
  const day = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="page-intro-title">{t('기회', 'Opportunities')}</h1>
            <p className="page-intro-description !max-w-none">{t(`개발자들이 실제로 말한 문제 ${opportunities.length}개. 원문 ${MIN_EVIDENCE}건과 플랫폼 ${MIN_PLATFORMS}곳을 넘으면 기준을 통과한 기회가 됩니다.`, `${opportunities.length} problems developers actually described. ${MIN_EVIDENCE} quotes on ${MIN_PLATFORMS} platforms makes one a verified opportunity.`)}</p>
          </div>
          <Link href="/ideas" className="btn-quiet">{t('내 아이디어 평가하기', 'Rate my idea')}</Link>
        </header>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action="/opportunities" role="search" className="min-w-[240px] flex-1">
              {stage && <input type="hidden" name="stage" value={stage} />}
              <input type="search" name="q" defaultValue={q ?? ''} aria-label={t('기회 찾기', 'Find opportunities')} placeholder={t('만들고 싶은 것을 입력하면 맞는 원문과 기회를 찾습니다', 'Type what you want to build to find matching quotes and opportunities')} className="h-12 w-full border bg-white px-4 text-[15px] text-ink placeholder:text-muted" />
            </form>
            <nav className="seg" aria-label={t('단계로 걸러 보기', 'Filter by stage')}>
              <Link href={href({})} aria-current={stage === 'verified' || stage === 'gathering' ? undefined : 'page'}>{t('전체', 'All')} {opportunities.length}</Link>
              <Link href={href({ stage: 'verified' })} aria-current={stage === 'verified' ? 'page' : undefined}>{t('기준 통과', 'Verified')} {verified}</Link>
              <Link href={href({ stage: 'gathering' })} aria-current={stage === 'gathering' ? 'page' : undefined}>{t('원문 모으는 중', 'Gathering')} {opportunities.length - verified}</Link>
            </nav>
          </div>

          <OpportunityTable opportunities={visible} lang={lang} />
          {sorted.length > visible.length && <Link href={href({ stage, all: true })} scroll={false} className="link-seed self-start">{t(`${sorted.length - visible.length}개 더 보기`, `Show ${sorted.length - visible.length} more`)} ›</Link>}
          <p className="max-w-[62em] text-[13px] leading-6 text-muted">
            {t(`${day.format(new Date(generatedAt))}에 분석했습니다. 원문은 공개 글에서 찾아 글자 단위로 대조한 문장만 남겼습니다. 기존 도구는 GitHub, npm, Show HN, VS Code 마켓만 조사했고, 직접 경쟁인지는 무료 AI 모델이 판정했습니다.`, `Analyzed ${new Date(generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}. Every quote was found in a public post and matched to the source character by character. Existing tools come from GitHub, npm, Show HN and the VS Code marketplace; a free AI model judged which are direct rivals.`)}
          </p>
        </div>

        {!stage && !query && record.length > 0 && (
          <section aria-labelledby="record-heading">
            <h2 id="record-heading" className="text-xl font-bold tracking-tight">{t('적중 기록', 'Track record')}</h2>
            <p className="mt-1 max-w-[46em] text-sm leading-6 text-muted">{t('불만이 먼저 나오고, 그 뒤에 관련 도구가 나온 문제입니다. 가지고 있는 가장 이른 원문 날짜와 도구가 만들어진 날짜를 비교했습니다. 더 이른 원문이 있었을 수 있습니다.', 'Problems where the complaint came first and a related tool appeared later. We compare the earliest quote we hold with the date each tool was created; earlier complaints may exist.')}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-outline-soft py-6 sm:grid-cols-4">
              {([
                [t('먼저 짚은 문제', 'Called early'), `${summary.hits}/${summary.total}`, `${summary.rate}%`],
                [t('뒤에 나온 도구', 'Tools that followed'), String(summary.tools), t('개', 'tools')],
                [t('앞선 기간 중간값', 'Median lead'), summary.medianLeadDays.toLocaleString('en-US'), t('일', 'days')],
                [t('가장 길게 앞선 기간', 'Longest lead'), summary.maxLeadDays.toLocaleString('en-US'), t('일', 'days')],
              ] as const).map(([label, value, unit]) => (
                <div key={label}>
                  <dt className="label">{label}</dt>
                  <dd className="mt-1.5 text-sm text-muted"><span className="mr-1 text-[28px] font-bold leading-none tracking-tight text-ink">{value}</span>{unit}</dd>
                </div>
              ))}
            </dl>
            <ul>
              {record.map((row) => (
                <li key={row.slug} className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-2 border-b border-outline-soft py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <div className="min-w-0">
                    <Link href={`/opportunities/${row.slug}`} className="text-[15px] font-semibold underline-offset-4 hover:underline">{row.name}</Link>
                    <p className="mt-0.5 text-[13px] text-muted">{t('첫 원문', 'First quote')} <time dateTime={row.firstSeenAt}>{day.format(new Date(row.firstSeenAt))}</time></p>
                  </div>
                  <ul className="grid min-w-0 gap-1.5">
                    {row.followers.slice(0, 3).map((tool) => (
                      <li key={tool.url} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm">
                        <span className="flex min-w-0 items-baseline justify-between gap-3">
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-muted underline-offset-4 hover:text-ink hover:underline">{tool.name}</a>
                          <span className="shrink-0 text-[13px] text-ink">{t(`${tool.leadDays.toLocaleString('ko-KR')}일 뒤`, `${tool.leadDays.toLocaleString('en-US')} days later`)}</span>
                        </span>
                        {/* How far ahead the complaint was, on one scale for the whole list. */}
                        <span aria-hidden="true" className="h-1 rounded-full bg-surface-high"><span className="block h-full rounded-full bg-seed" style={{ width: `${Math.max(4, Math.round((tool.leadDays / Math.max(1, summary.maxLeadDays)) * 100))}%` }} /></span>
                      </li>
                    ))}
                    {row.followers.length > 3 && <li className="text-[13px] text-muted">{t(`외 ${row.followers.length - 3}개`, `and ${row.followers.length - 3} more`)}</li>}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
