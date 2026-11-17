'use client';

import Link from 'next/link';
import { useState } from 'react';

/** One problem on the map. Every number is counted from stored data; nothing here is a model's opinion. */
export type MapPoint = {
  slug: string;
  name: string;
  problem: string;
  /** 0..1, from quotes × platforms on a log scale. */
  strength: number;
  /** 0..1, 1 when no direct competitor was found. */
  openness: number;
  evidence: number;
  platforms: number;
  direct: number;
  recent: number;
  qualified: boolean;
  quote: { text: string; source: string; url: string } | null;
};

const W = 640;
const H = 380;
const PAD = { left: 20, right: 20, top: 28, bottom: 36 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const x = (value: number) => PAD.left + value * plotW;
const y = (value: number) => PAD.top + (1 - value) * plotH;

/**
 * Today's opportunity map: evidence strength across, how empty the market is up. Top right is "strong evidence,
 * nobody has built it yet". Clicking a point (or a row of the list, for keyboards and phones) opens its card.
 */
export default function OpportunityMap({ points }: { points: MapPoint[] }) {
  const best = points.find((point) => point.strength >= 0.5 && point.openness >= 0.5) ?? points[0];
  const [selected, setSelected] = useState(best?.slug ?? '');
  const current = points.find((point) => point.slug === selected) ?? best;
  if (!current) return null;
  const ranked = [...points].sort((a, b) => b.strength + b.openness - (a.strength + a.openness)).slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <figure className="card min-w-0 p-4 sm:p-5">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-1 text-sm">
          <span className="font-semibold">기회 지도</span>
          <span className="text-[13px] text-muted">점이나 아래 목록을 누르면 카드가 바뀝니다</span>
        </figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" role="img" aria-label="근거 강도와 빈자리로 놓은 기회 지도. 아래 목록에서도 고를 수 있습니다.">
          <rect x={x(0.5)} y={y(1)} width={plotW / 2} height={plotH / 2} className="fill-seed-soft" />
          <text x={x(1) - 8} y={y(0.5) - 10} textAnchor="end" fontSize="12" fontWeight="600" className="fill-seed">근거는 탄탄한데 아직 비어 있음</text>
          {[0, 0.5, 1].map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={y(0)} y2={y(1)} className="stroke-outline-soft" strokeDasharray={tick === 0.5 ? '4 4' : undefined} />
              <line x1={x(0)} x2={x(1)} y1={y(tick)} y2={y(tick)} className="stroke-outline-soft" strokeDasharray={tick === 0.5 ? '4 4' : undefined} />
            </g>
          ))}
          <text x={x(1)} y={H - 10} textAnchor="end" fontSize="12" className="fill-muted">근거 강도 (원문 × 플랫폼) →</text>
          <text x={PAD.left} y={14} fontSize="12" className="fill-muted">↑ 빈자리 (직접 경쟁이 적을수록 위)</text>
          {points.map((point) => {
            const on = point.slug === current.slug;
            const r = 6 + Math.min(point.recent, 4) * 2.5;
            return (
              <g key={point.slug} className="cursor-pointer" onClick={() => setSelected(point.slug)}>
                <title>{point.name}</title>
                <circle cx={x(point.strength)} cy={y(point.openness)} r={r} className={point.qualified ? 'fill-seed' : 'fill-outline-strong'} opacity={on ? 1 : 0.55} />
                {on && <circle cx={x(point.strength)} cy={y(point.openness)} r={r + 5} fill="none" className="stroke-ink" strokeWidth={2} />}
              </g>
            );
          })}
        </svg>
        <p className="mt-2 px-1 text-[12.5px] leading-5 text-muted">초록 점은 기준 통과(원문 3건·플랫폼 2곳 이상), 회색은 원문을 더 모으는 중입니다. 점이 클수록 최근 3개월에 나온 원문이 많습니다. 모두 저장된 수치로 그렸고 AI가 매긴 점수가 아닙니다.</p>
        <ol className="mt-4 grid gap-1 border-t border-outline-soft pt-3 sm:grid-cols-2" aria-label="빈자리가 큰 기회">
          {ranked.map((point, index) => (
            <li key={point.slug}>
              <button type="button" onClick={() => setSelected(point.slug)} aria-pressed={point.slug === current.slug} className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-low aria-pressed:bg-seed-soft">
                <span className="num w-4 shrink-0 text-muted">{index + 1}</span>
                <span className="min-w-0 truncate">{point.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </figure>

      <article className="card flex flex-col p-6" aria-live="polite">
        <p className="text-[13px] text-muted">
          {current.qualified ? <span className="font-medium text-seed">기준 통과</span> : '원문 모으는 중'}
          {' · '}{current.direct ? `직접 경쟁 ${current.direct}개` : '직접 경쟁 없음'}
        </p>
        <h2 className="mt-2 text-xl font-bold leading-snug tracking-tight">{current.name}</h2>
        <p className="mt-2 text-[15px] leading-7 text-tertiary">{current.problem}</p>
        {current.quote && (
          <blockquote className="mt-4 border-l-2 border-seed pl-4">
            <p lang="en" className="text-[15px] leading-7">“{current.quote.text}”</p>
            <footer className="mt-1 text-[12.5px] text-muted">{current.quote.source} · 원문과 일치 · <a href={current.quote.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline">원문</a></footer>
          </blockquote>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-outline-soft py-4 text-center">
          {([['원문', current.evidence], ['플랫폼', current.platforms], ['최근 3개월', current.recent]] as const).map(([label, value]) => (
            <div key={label}><dt className="text-[12.5px] text-muted">{label}</dt><dd className="num mt-1 text-xl font-bold">{value}</dd></div>
          ))}
        </dl>
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Link href={`/prd?opportunity=${encodeURIComponent(current.slug)}`} className="btn h-11 px-4">이 문제로 PRD 만들기</Link>
          <Link href={`/opportunities/${current.slug}`} className="btn-quiet h-11 px-4">자세히</Link>
        </div>
      </article>
    </div>
  );
}
