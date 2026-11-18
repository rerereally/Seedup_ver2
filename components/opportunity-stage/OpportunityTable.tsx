import Link from 'next/link';
import { BUILD_LABELS, MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
import type { Opportunity, OpportunityStatus } from '@/lib/opportunities/types';
import type { OpportunityFunnel } from '@/lib/opportunities/data';

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  open: '경쟁 적음',
  narrowing: '경쟁 늘어남',
  closed: '경쟁 많음',
  unknown: '확인 중',
};

const STATUS_LABELS_EN: Record<OpportunityStatus, string> = { open: 'Few rivals', narrowing: 'Rivals growing', closed: 'Crowded', unknown: 'Checking' };

const STATUS_DOTS: Record<OpportunityStatus, string> = {
  open: 'bg-seed',
  narrowing: 'bg-ink',
  closed: 'bg-outline-strong',
  unknown: 'bg-outline-strong',
};

export function StatusLabel({ status, lang = 'ko' }: { status: OpportunityStatus; lang?: 'ko' | 'en' }) {
  const quiet = status === 'closed' || status === 'unknown';
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${quiet ? 'text-muted' : 'font-bold text-ink'}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOTS[status]}`} />
      {(lang === 'en' ? STATUS_LABELS_EN : STATUS_LABELS)[status]}
      {/* Rival counts come from a model reading product descriptions, so the label says it is a judgement, not a measurement. */}
      {status !== 'unknown' && <span className="rounded border border-outline-strong px-1 text-[11px] font-normal leading-4 text-muted" title={lang === 'en' ? 'A free AI model judged which existing tools are direct rivals.' : '기존 도구가 직접 경쟁인지는 무료 AI 모델이 판정했습니다.'}>{lang === 'en' ? 'AI judged' : 'AI 판정'}</span>}
    </span>
  );
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
    [funnel.quotes, '원문과 일치한 인용', '지어낸 문장은 여기서 탈락합니다'],
    [funnel.problems, '묶인 문제', '같은 불만끼리 모았습니다'],
    [funnel.qualified, '기준 통과', `원문 ${MIN_EVIDENCE}건, 플랫폼 ${MIN_PLATFORMS}곳 이상`],
    [funnel.open, '경쟁이 적은 기회', '직접 경쟁이 아직 적습니다'],
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

/** What a problem still needs before it counts as verified, in the reader's words. Verified is the default, so it says nothing. */
function stageLabel(item: Opportunity, en: boolean) {
  if (item.qualified) return '';
  const quotes = MIN_EVIDENCE - item.evidence.length;
  if (quotes > 0) return en ? `${quotes} more needed` : `${quotes}건 더 필요`;
  const platforms = Math.max(1, MIN_PLATFORMS - item.platforms.length);
  return en ? `${platforms} more platform` : `플랫폼 ${platforms}곳 더 필요`;
}

export default function OpportunityTable({ opportunities, lang = 'ko' }: { opportunities: Opportunity[]; lang?: 'ko' | 'en' }) {
  const en = lang === 'en';
  if (!opportunities.length) return <p className="empty-state">{en ? 'No opportunity matches yet.' : '이 조건에 맞는 기회가 아직 없습니다.'}</p>;

  return (
    <table className="w-full table-fixed border-collapse text-[15px]">
      <colgroup>
        <col />
        <col className="hidden w-[80px] sm:table-column" />
        <col className="hidden w-[150px] min-[1400px]:table-column" />
        <col className="hidden w-[100px] min-[1400px]:table-column" />
      </colgroup>
      <thead>
        <tr className="border-b border-outline-strong text-left text-[13px] text-muted">
          <th scope="col" className="py-3 pr-4 font-normal">{en ? 'Problem' : '문제'}</th>
          <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">{en ? 'Quotes' : '원문'}</th>
          <th scope="col" className="hidden py-3 pr-4 font-normal min-[1400px]:table-cell">{en ? 'Platforms' : '플랫폼'}</th>
          <th scope="col" className="hidden py-3 font-normal min-[1400px]:table-cell">{en ? 'Rival tools' : '경쟁 도구'}</th>
        </tr>
      </thead>
      <tbody>
        {opportunities.map((item) => (
          // data-slug lets the side preview follow the row being pointed at (OpportunityMap), and mark it.
          <tr key={item.slug} data-slug={item.slug} className="relative border-b border-outline-soft transition-colors hover:bg-surface-low data-[previewed]:bg-surface-low data-[previewed]:shadow-[inset_2px_0_0_var(--color-seed)]">
            <td className="py-5 pr-4">
              {/* The stretched link makes the whole row a target while the table stays a real table. */}
              <Link href={`/opportunities/${item.slug}`} className="font-semibold text-ink after:absolute after:inset-0 after:content-['']">{localizedOpportunity(item, lang).name}</Link>
              {item.build && <span className="chip ml-2 align-middle" title={en ? 'AI estimate for one person building with AI coding tools' : 'AI 코딩 도구로 혼자 만들 때의 AI 추정'}>{BUILD_LABELS[item.build.size][en ? 1 : 0]}</span>}
              {!item.qualified && <span className="ml-2 align-middle text-[13px] text-muted">{en ? 'Gathering' : '원문 모으는 중'}, {stageLabel(item, en)}</span>}
              <p className="mt-1 line-clamp-2 text-sm text-muted sm:line-clamp-1">{item.audience && <span className="text-tertiary">{en ? item.audienceEn || item.audience : item.audience}: </span>}{localizedOpportunity(item, lang).problem}</p>
            </td>
            <td className="num hidden py-5 pr-4 sm:table-cell">{item.evidence.length}</td>
            <td className="hidden truncate py-5 pr-4 min-[1400px]:table-cell" title={item.platforms.map((platform) => PLATFORM_LABELS[platform]).join(', ')}>
              {item.platforms.length ? PLATFORM_LABELS[item.platforms[0]] : ''}{item.platforms.length > 1 && <span className="text-muted">{en ? ` +${item.platforms.length - 1}` : ` 외 ${item.platforms.length - 1}곳`}</span>}
            </td>
            <td className="hidden py-5 min-[1400px]:table-cell">{item.directCount ? <span className="num">{item.directCount}{en ? '' : '개'}</span> : <span className="text-muted">{en ? 'None' : '없음'}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
