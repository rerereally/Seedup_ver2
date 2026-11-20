import { PERIODS, type PeriodKey, type PeriodState } from '@/lib/popularity';
import Link from 'next/link';

/** 전체 / 1일 / 1주 / 1달 / 1년. A period the stored history cannot cover yet is shown but cannot be picked. */
export default function PeriodTabs({ state, href, label = '기간' }: { state: PeriodState; href: (period: PeriodKey | null) => string; label?: string }) {
  const unready = `기록이 ${state.historyDays}일치라 아직 비교할 수 없습니다`;
  return (
    <nav aria-label={label} className="seg">
      <Link href={href(null)} aria-current={!state.period ? 'page' : undefined}>전체</Link>
      {PERIODS.map((period) => state.ready[period.key]
        ? <Link key={period.key} href={href(period.key)} aria-current={state.period?.key === period.key ? 'page' : undefined}>{period.label}</Link>
        : <span key={period.key} aria-disabled="true" title={unready} className="cursor-not-allowed opacity-40 hover:!text-muted">{period.label}<span className="sr-only">, {unready}</span></span>)}
    </nav>
  );
}
