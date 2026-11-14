import Link from 'next/link';
import { MIN_EVIDENCE, MIN_PLATFORMS, localizedOpportunity } from '@/lib/opportunities/types';
import type { Opportunity, OpportunityStatus } from '@/lib/opportunities/types';
import type { OpportunityFunnel } from '@/lib/opportunities/data';

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  open: '열림',
  narrowing: '좁아지는 중',
  closed: '닫힘',
  unknown: '조사 중',
};

const STATUS_LABELS_EN: Record<OpportunityStatus, string> = { open: 'Open', narrowing: 'Narrowing', closed: 'Closed', unknown: 'Researching' };

const STATUS_DOTS: Record<OpportunityStatus, string> = {
  open: 'bg-[#3ddc84]',
  narrowing: 'bg-[#ffc400]',
  closed: 'bg-outline-strong',
  unknown: 'bg-outline-strong',
};

const NEUTRAL = '#62626a';

export function StatusLabel({ status, lang = 'ko' }: { status: OpportunityStatus; lang?: 'ko' | 'en' }) {
  const quiet = status === 'closed' || status === 'unknown';
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${quiet ? 'text-muted' : 'font-bold text-ink'}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOTS[status]}`} />
      {(lang === 'en' ? STATUS_LABELS_EN : STATUS_LABELS)[status]}
    </span>
  );
}

/** The count next to a bar that fills up at the pass mark, so a row shows how close it is at a glance. */
function Meter({ value, bar, color }: { value: number; bar: number; color: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <span aria-hidden="true" className="flex gap-[3px]">
        {Array.from({ length: bar }, (_, index) => (
          <span key={index} className="h-3.5 w-[5px] rounded-full" style={{ background: index < value ? color : 'var(--color-surface-high)' }} />
        ))}
      </span>
      <span className="num w-5 text-right">{value}</span>
    </span>
  );
}

function TopSupply({ item, lang }: { item: Opportunity; lang: 'ko' | 'en' }) {
  const direct = item.supply.filter((supply) => supply.relation === 'direct');
  const biggest = direct.filter((supply) => supply.kind === 'github').sort((a, b) => b.popularity - a.popularity)[0];
  if (biggest) {
    return (
      <span className="inline-flex max-w-full items-baseline justify-end gap-2">
        <span className="truncate text-muted">{biggest.name}</span>
        <span className="num shrink-0 text-ink">★{biggest.popularity.toLocaleString('en-US')}</span>
      </span>
    );
  }
  if (item.directCount) return lang === 'en' ? <span className="text-muted"><span className="num text-ink">{item.directCount}</span> direct rivals</span> : <span className="text-muted">직접 경쟁 <span className="num text-ink">{item.directCount}</span>개</span>;
  return <span className="text-muted">{lang === 'en' ? 'None yet' : '아직 없음'}</span>;
}

// Two columns on a phone, four in a row on a wide screen; each step only draws the lines that face a neighbour.
const STEP_BORDERS = ['', 'border-l', 'border-t lg:border-l lg:border-t-0', 'border-l border-t lg:border-t-0'];

export function FunnelStrip({ funnel, lang = 'ko' }: { funnel: OpportunityFunnel; lang?: 'ko' | 'en' }) {
  const steps: Array<[number, string, string]> = lang === 'en' ? [
    [funnel.quotes, 'Quotes verified verbatim', 'Invented sentences are dropped here'],
    [funnel.problems, 'Problems grouped', 'The same complaint, merged'],
    [funnel.qualified, 'Passed the bar', `${MIN_EVIDENCE}+ posts on ${MIN_PLATFORMS}+ platforms`],
    [funnel.open, 'Open now', 'Few direct rivals so far'],
  ] : [
    [funnel.quotes, '원문과 일치한 증언', '지어낸 문장은 여기서 탈락합니다'],
    [funnel.problems, '묶인 문제', '같은 불만끼리 모았습니다'],
    [funnel.qualified, '기준 통과', `게시글 ${MIN_EVIDENCE}건, 플랫폼 ${MIN_PLATFORMS}종 이상`],
    [funnel.open, '지금 열린 기회', '직접 경쟁이 아직 적습니다'],
  ];
  return (
    <ol className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-outline-soft lg:grid-cols-4">
      {steps.map(([value, label, hint], index) => {
        const last = index === steps.length - 1;
        return (
          <li key={label} className={`relative border-outline-soft px-5 py-5 ${STEP_BORDERS[index]}`}>
            <p className="label">{label}</p>
            <p className={`num mt-1 text-[40px] font-semibold leading-none ${last ? 'text-hot' : 'text-ink'}`}>{value}</p>
            <p className="mt-2 text-[13px] leading-5 text-muted">{hint}</p>
            {!last && <span aria-hidden="true" className="absolute right-0 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-outline-soft bg-surface text-xs text-muted lg:flex">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function OpportunityTable({ opportunities, colors, lang = 'ko' }: { opportunities: Opportunity[]; colors: Record<string, { bg: string }>; lang?: 'ko' | 'en' }) {
  const en = lang === 'en';
  if (!opportunities.length) return <p className="empty-state">{en ? 'No opportunity matches yet.' : '이 조건에 맞는 기회가 아직 없습니다.'}</p>;

  return (
    <div className="overflow-hidden rounded-[20px] border border-outline-soft">
      <table className="w-full table-fixed border-collapse text-[15px]">
        <colgroup>
          <col />
          <col className="w-[112px] sm:w-[132px]" />
          <col className="hidden w-[104px] sm:table-column" />
          <col className="hidden w-[104px] sm:table-column" />
          <col className="hidden w-[250px] lg:table-column" />
        </colgroup>
        <thead>
          <tr className="text-left text-[13px] text-muted">
            <th scope="col" className="px-5 py-3 font-medium">{en ? 'Opportunity' : '기회'}</th>
            <th scope="col" className="px-2 py-3 font-medium">{en ? 'Status' : '상태'}</th>
            <th scope="col" className="hidden px-2 py-3 text-right font-medium sm:table-cell">{en ? 'Quotes' : '근거'}</th>
            <th scope="col" className="hidden px-2 py-3 text-right font-medium sm:table-cell">{en ? 'Platforms' : '플랫폼'}</th>
            <th scope="col" className="hidden px-5 py-3 text-right font-medium lg:table-cell">{en ? 'Biggest existing tool' : '가장 큰 기존 도구'}</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((item) => {
            const color = colors[item.slug]?.bg ?? NEUTRAL;
            return (
              <tr key={item.slug} className="group relative border-t border-outline-soft transition-colors hover:bg-surface-low">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3.5">
                    <span aria-hidden="true" className="mt-[7px] h-2.5 w-6 shrink-0 rounded-full" style={{ background: color }} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {/* The stretched link makes the whole row a target while the table stays a real table. */}
                        <Link href={`/opportunities/${item.slug}`} className="font-bold text-ink after:absolute after:inset-0 after:content-['']">{localizedOpportunity(item, lang).name}</Link>
                        {item.qualified && <span className="rounded-full bg-[#0f2a1c] px-2 py-0.5 text-xs font-bold text-[#5fe3a1]">{en ? 'Passed' : '기준 통과'}</span>}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted sm:line-clamp-1">{localizedOpportunity(item, lang).problem}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-4 align-top text-sm"><StatusLabel status={item.status} lang={lang} /></td>
                <td className="hidden px-2 py-4 text-right align-top sm:table-cell"><Meter value={item.evidence.length} bar={MIN_EVIDENCE} color={color} /></td>
                <td className="hidden px-2 py-4 text-right align-top sm:table-cell"><Meter value={item.platforms.length} bar={MIN_PLATFORMS} color={color} /></td>
                <td className="hidden px-5 py-4 text-right align-top text-sm lg:table-cell"><TopSupply item={item} lang={lang} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
