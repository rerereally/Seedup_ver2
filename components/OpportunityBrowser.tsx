import Link from 'next/link';
import OpportunityTable from '@/components/opportunity-stage/OpportunityTable';
import { translator } from '@/lib/i18n';
import { trackRecord, trackRecordSummary } from '@/lib/opportunities/insight';
import { BUILD_LABELS } from '@/lib/opportunities/types';
import type { Opportunity } from '@/lib/opportunities/types';

const PAGE_SIZE = 12;

/**
 * Every problem the engine holds: search, stage filter, the table and the track record.
 * It lives under the weekly issue, so `basePath` and `keep` carry that page's own query along.
 */
export default function OpportunityBrowser({ opportunities, generatedAt, lang, stage: stageParam, size: sizeParam, q, all, basePath, keep = {} }: {
  opportunities: Opportunity[];
  generatedAt: string;
  lang: 'ko' | 'en';
  stage?: string;
  size?: string;
  q?: string;
  all?: string;
  basePath: string;
  keep?: Record<string, string | undefined>;
}) {
  const t = translator(lang);
  const query = q?.trim().toLowerCase() ?? '';
  const verified = opportunities.filter((item) => item.qualified).length;
  // shortcut: plain keyword match on name, problem and keywords; switch to /api/opportunities/match when meaning-based search is needed here.
  const matched = query
    ? opportunities.filter((item) => [item.name, item.problem, item.nameEn, item.problemEn, ...item.keywords].some((value) => value?.toLowerCase().includes(query)))
    : opportunities;
  // Status (verified, gathering) and build size are two separate questions. Old ?stage=weekend links still land on the size filter.
  const stage = stageParam === 'verified' || stageParam === 'gathering' ? stageParam : undefined;
  const size = sizeParam === 'weekend' || sizeParam === 'weeks' || sizeParam === 'team' ? sizeParam : stageParam === 'weekend' ? 'weekend' : undefined;
  const sizes = (['weekend', 'weeks', 'team'] as const).map((key) => [key, opportunities.filter((item) => item.build?.size === key).length] as const).filter(([, count]) => count > 0);
  const filtered = matched
    .filter((item) => (stage === 'verified' ? item.qualified : stage === 'gathering' ? !item.qualified : true))
    .filter((item) => (size ? item.build?.size === size : true));
  // Verified problems first, then the ones closest to the bar.
  const sorted = [...filtered].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length);
  const visible = all ? sorted : sorted.slice(0, PAGE_SIZE);
  const kept = Object.entries(keep).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const href = (next: { stage?: string; size?: string; all?: boolean }) => {
    const params = new URLSearchParams(kept);
    if (next.stage) params.set('stage', next.stage);
    if (next.size) params.set('size', next.size);
    if (q?.trim()) params.set('q', q.trim());
    if (next.all) params.set('all', '1');
    const search = params.toString();
    return `${basePath}${search ? `?${search}` : ''}#problems`;
  };
  const record = trackRecord(opportunities);
  const summary = trackRecordSummary(record, opportunities.length);
  const day = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <form action={`${basePath}#problems`} role="search" className="min-w-[240px] flex-1">
            {kept.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            {stage && <input type="hidden" name="stage" value={stage} />}
            {size && <input type="hidden" name="size" value={size} />}
            <input type="search" name="q" defaultValue={q ?? ''} aria-label={t('문제 찾기', 'Find problems')} placeholder={t('문제나 키워드로 찾기', 'Search problems or keywords')} className="h-12 w-full border bg-white px-4 text-[15px] text-ink placeholder:text-muted" />
          </form>
          <nav className="seg" aria-label={t('상태로 걸러 보기', 'Filter by status')}>
            <Link href={href({ size })} scroll={false} aria-current={stage ? undefined : 'page'}>{t('전체', 'All')} {opportunities.length}</Link>
            <Link href={href({ stage: 'verified', size })} scroll={false} aria-current={stage === 'verified' ? 'page' : undefined}>{t('검증된 문제', 'Verified')} {verified}</Link>
            <Link href={href({ stage: 'gathering', size })} scroll={false} aria-current={stage === 'gathering' ? 'page' : undefined}>{t('원문 모으는 중', 'Gathering')} {opportunities.length - verified}</Link>
          </nav>
        </div>
        {sizes.length > 0 && (
          <nav className="examples -mt-2" aria-label={t('규모로 걸러 보기', 'Filter by size')}>
            <span>{t('규모', 'Size')}</span>
            <Link href={href({ stage })} scroll={false} aria-current={size ? undefined : 'page'} className="example aria-[current=page]:font-semibold aria-[current=page]:text-ink">{t('모두', 'Any')}</Link>
            {sizes.map(([key, count]) => (
              <Link key={key} href={href({ stage, size: key })} scroll={false} aria-current={size === key ? 'page' : undefined} className="example aria-[current=page]:font-semibold aria-[current=page]:text-ink">{BUILD_LABELS[key][lang === 'en' ? 1 : 0]} {count}</Link>
            ))}
          </nav>
        )}

        <OpportunityTable opportunities={visible} lang={lang} />
        {sorted.length > visible.length && <Link href={href({ stage, all: true })} scroll={false} className="link-seed self-start">{t(`${sorted.length - visible.length}개 더 보기`, `Show ${sorted.length - visible.length} more`)}</Link>}
        <p className="max-w-[62em] text-[13px] leading-6 text-muted">
          {t(`${day.format(new Date(generatedAt))}에 분석했습니다. 원문은 공개 글에서 찾아 글자 단위로 대조한 문장만 남겼습니다. 기존 도구는 GitHub, npm, Show HN, VS Code 마켓, App Store만 조사했고, 직접 경쟁인지는 무료 AI 모델이 판정했습니다.`, `Analyzed ${new Date(generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}. Every quote was found in a public post and matched to the source character by character. Existing tools come from GitHub, npm, Show HN, the VS Code marketplace and the App Store; a free AI model judged which are direct rivals.`)}
        </p>
      </div>

      {!stage && !size && !query && record.length > 0 && (
        <section aria-labelledby="record-heading">
          <h3 id="record-heading" className="text-xl font-bold tracking-tight">{t('적중 기록', 'Track record')}</h3>
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
    </>
  );
}
