import Link from 'next/link';
import { MIN_EVIDENCE, MIN_PLATFORMS, localizedOpportunity } from '@/lib/opportunities/types';
import type { Opportunity, OpportunityStatus, Platform } from '@/lib/opportunities/types';
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

const SHORT_PLATFORM: Record<Platform, string> = { github: 'GitHub', hn: 'HN', stackoverflow: 'Stack Overflow', devto: 'DEV', lobsters: 'Lobsters' };

/** What a problem still needs before it counts as verified, in the reader's words. */
function stageLabel(item: Opportunity, en: boolean) {
  if (item.qualified) return en ? 'Verified' : '기준 통과';
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
        <col className="hidden w-[190px] md:table-column" />
        <col className="hidden w-[100px] md:table-column" />
        <col className="w-[104px] sm:w-[120px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-outline-strong text-left text-[13px] text-muted">
          <th scope="col" className="py-3 pr-4 font-normal">{en ? 'Problem' : '문제'}</th>
          <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">{en ? 'Quotes' : '원문'}</th>
          <th scope="col" className="hidden py-3 pr-4 font-normal md:table-cell">{en ? 'Platforms' : '플랫폼'}</th>
          <th scope="col" className="hidden py-3 pr-4 font-normal md:table-cell">{en ? 'Direct rivals' : '직접 경쟁'}</th>
          <th scope="col" className="py-3 font-normal">{en ? 'Stage' : '단계'}</th>
        </tr>
      </thead>
      <tbody>
        {opportunities.map((item) => (
          <tr key={item.slug} className="relative border-b border-outline-soft transition-colors hover:bg-surface-low">
            <td className="py-5 pr-4">
              {/* The stretched link makes the whole row a target while the table stays a real table. */}
              <Link href={`/opportunities/${item.slug}`} className="font-semibold text-ink after:absolute after:inset-0 after:content-['']">{localizedOpportunity(item, lang).name}</Link>
              <p className="mt-1 line-clamp-2 text-sm text-muted sm:line-clamp-1">{localizedOpportunity(item, lang).problem}</p>
            </td>
            <td className="num hidden py-5 pr-4 sm:table-cell">{item.evidence.length}</td>
            <td className="hidden py-5 pr-4 md:table-cell">{item.platforms.map((platform) => SHORT_PLATFORM[platform]).join(' · ')}</td>
            <td className="num hidden py-5 pr-4 md:table-cell">{item.directCount}</td>
            <td className={`py-5 text-sm ${item.qualified ? 'font-medium text-seed' : 'text-muted'}`}>{stageLabel(item, en)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
