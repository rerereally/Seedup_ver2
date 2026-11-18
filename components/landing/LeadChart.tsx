import Link from 'next/link';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { chartToolName } from '@/lib/opportunities/insight';
import type { TrackRecordRow } from '@/lib/opportunities/insight';

/**
 * The track record as a chart: for each problem, how many days passed between the earliest quote Seedup holds and the
 * first related tool that shipped after it. Bars share one scale, so the longest lead reads as the longest bar.
 */
export default function LeadChart({ rows, names, lang, limit = 6 }: { rows: TrackRecordRow[]; names: Record<string, string>; lang: Lang; limit?: number }) {
  const t = translator(lang);
  const month = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'short' });
  // Each row shows the earliest follower whose name reads as a tool; a row with none is left out.
  const leads = rows
    .flatMap((row) => {
      const first = row.followers.map((tool) => ({ ...tool, label: chartToolName(tool.name) })).find((tool) => tool.label);
      return first ? [{ ...row, first }] : [];
    })
    .sort((a, b) => b.first.leadDays - a.first.leadDays)
    .slice(0, limit);
  const longest = Math.max(1, ...leads.map((row) => row.first.leadDays));

  return (
    <figure className="min-w-0">
      <ol className="rows">
        {leads.map((row) => (
          <li key={row.slug} className="grid items-center gap-x-8 gap-y-2.5 py-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <Link href={`/opportunities/${row.slug}`} className="min-w-0 text-[16px] font-semibold leading-snug underline-offset-4 hover:underline">{names[row.slug] ?? row.name}</Link>
            <div className="min-w-0">
              <span aria-hidden="true" className="block h-2 rounded-full bg-surface-high">
                <span className="grow-x block h-full rounded-full bg-seed" style={{ width: `${Math.max(3, (row.first.leadDays / longest) * 100)}%` }} />
              </span>
              <p className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-[13px] text-muted">
                <span>{t(`첫 원문 ${month.format(new Date(row.firstSeenAt))}`, `First quote ${month.format(new Date(row.firstSeenAt))}`)}</span>
                <span className="min-w-0 truncate"><b className="num font-semibold text-ink">{t(`${row.first.leadDays}일 뒤`, `${row.first.leadDays} days later`)}</b> <a href={row.first.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-ink hover:underline">{row.first.label}</a></span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">{t('문제별로 가장 이른 원문과 그 뒤에 처음 나온 관련 도구 사이의 일수', 'Days between the earliest quote for each problem and the first related tool after it')}</figcaption>
    </figure>
  );
}
