'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { MIN_EVIDENCE, MIN_PLATFORMS } from '@/lib/opportunities/types';

/** One problem on the map. Every number is counted from stored data; nothing here is a model's opinion. */
export type MapPoint = {
  slug: string;
  name: string;
  problem: string;
  /** 0..1, from quotes × platforms on a log scale. */
  strength: number;
  /** 0..1, 1 when no direct or partial competitor was found. */
  openness: number;
  evidence: number;
  platforms: number;
  direct: number;
  recent: number;
  qualified: boolean;
  quote: { text: string; source: string; url: string } | null;
};

const W = 640;
const H = 360;
const PAD = 18;
const x = (value: number) => PAD + value * (W - PAD * 2);
const y = (value: number) => PAD + (1 - value) * (H - PAD * 2);

/**
 * Today's opportunity map: evidence strength across, how empty the market is up. Top right is "strong evidence,
 * nobody has built it yet". Clicking a point (or a row of the list, for keyboards and phones) opens its card.
 * Axis words sit outside the drawing as real text, so they stay readable when the drawing shrinks on a phone.
 */
export default function OpportunityMap({ points }: { points: MapPoint[] }) {
  const t = translator(useLang());
  const best = points.find((point) => point.strength >= 0.5 && point.openness >= 0.5) ?? points[0];
  const [selected, setSelected] = useState(best?.slug ?? '');
  const current = points.find((point) => point.slug === selected) ?? best;
  if (!current) return null;
  const ranked = [...points].sort((a, b) => b.strength + b.openness - (a.strength + a.openness)).slice(0, 6);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <figure className="card min-w-0 p-4 sm:p-6">
        <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-seed-soft ring-1 ring-seed/30" />{t('근거는 탄탄한데 아직 비어 있음', 'Strong evidence, still empty')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-seed" />{t(`원문 ${MIN_EVIDENCE}건, ${MIN_PLATFORMS}곳 이상 확인`, `${MIN_EVIDENCE}+ quotes from ${MIN_PLATFORMS}+ sites`)}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-outline-strong" />{t('원문 모으는 중', 'Still gathering')}</span>
        </figcaption>
        <p className="mt-4 text-[13px] text-muted">{t('위로 갈수록 경쟁 도구가 적음', 'Higher means fewer rival tools')}</p>
        <div className="mt-1">
          <svg viewBox={`0 0 ${W} ${H}`} data-kind="map" className="block h-auto w-full" role="img" aria-label={t('근거 강도와 경쟁 정도로 놓은 기회 지도. 아래 목록에서도 고를 수 있습니다.', 'Opportunity map by evidence strength and competition. The list below picks the same problems.')}>
            <rect x={x(0.5)} y={y(1)} width={(W - PAD * 2) / 2} height={(H - PAD * 2) / 2} rx="10" className="fill-seed-soft" />
            {[0, 0.5, 1].map((tick) => (
              <g key={tick}>
                <line x1={x(tick)} x2={x(tick)} y1={y(0)} y2={y(1)} className="stroke-outline-soft" strokeDasharray={tick === 0.5 ? '4 4' : undefined} />
                <line x1={x(0)} x2={x(1)} y1={y(tick)} y2={y(tick)} className="stroke-outline-soft" strokeDasharray={tick === 0.5 ? '4 4' : undefined} />
              </g>
            ))}
            {points.map((point) => {
              const on = point.slug === current.slug;
              const r = 5 + Math.min(point.recent, 4) * 1.5;
              return (
                <g key={point.slug} className="cursor-pointer" onClick={() => setSelected(point.slug)}>
                  <title>{point.name}</title>
                  <circle cx={x(point.strength)} cy={y(point.openness)} r={r + 6} fill="transparent" />
                  <circle cx={x(point.strength)} cy={y(point.openness)} r={r} className={point.qualified ? 'fill-seed' : 'fill-outline-strong'} opacity={on ? 1 : 0.6} />
                  {on && <circle cx={x(point.strength)} cy={y(point.openness)} r={r + 5} fill="none" className="stroke-ink" strokeWidth={2} />}
                </g>
              );
            })}
          </svg>
        </div>
        <p className="mt-2 text-right text-[13px] text-muted">{t('오른쪽으로 갈수록 원문이 많고 나온 곳도 많음. 오늘 지도에 오른 문제끼리 비교한 위치입니다.', 'Further right means more quotes from more places. Positions compare today’s problems with each other.')}</p>
        <ol className="mt-4 grid gap-0.5 border-t border-outline-soft pt-3 sm:grid-cols-2" aria-label={t('빈자리가 큰 기회', 'Most open opportunities')}>
          {ranked.map((point, index) => (
            <li key={point.slug}>
              <button type="button" onClick={() => setSelected(point.slug)} aria-pressed={point.slug === current.slug} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] hover:bg-surface-low aria-pressed:bg-seed-soft aria-pressed:font-semibold">
                <span className="num w-4 shrink-0 text-muted">{index + 1}</span>
                <span className="min-w-0 truncate">{point.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </figure>

      <article className="card flex min-w-0 flex-col p-6 lg:self-start" aria-live="polite">
        <p className="text-[13px] text-muted">
          {current.qualified ? <span className="font-semibold text-seed">{t(`원문 ${MIN_EVIDENCE}건, ${MIN_PLATFORMS}곳 이상 확인`, `${MIN_EVIDENCE}+ quotes from ${MIN_PLATFORMS}+ sites`)}</span> : t('원문 모으는 중', 'Still gathering')}
          <span className="ml-3">{current.direct ? t(`직접 경쟁 ${current.direct}개`, `${current.direct} direct rivals`) : t('직접 경쟁 없음', 'No direct rival')}</span>
        </p>
        <h3 className="mt-2 text-xl font-bold leading-snug tracking-tight">{current.name}</h3>
        <p className="mt-2 line-clamp-4 text-[15px] leading-7 text-tertiary">{current.problem}</p>
        {current.quote && (
          <blockquote className="mt-4 border-l-2 border-seed pl-4">
            <p lang="en" className="line-clamp-4 text-[15px] leading-7">“{current.quote.text}”</p>
            <footer className="mt-1 text-[13px] text-muted">
              {current.quote.source}
              <a href={current.quote.url} target="_blank" rel="noopener noreferrer" className="ml-3 text-seed underline-offset-4 hover:underline">{t('원문 보기', 'Source')}</a>
            </footer>
          </blockquote>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-outline-soft py-4 text-center">
          {([[t('원문', 'Quotes'), current.evidence], [t('플랫폼', 'Platforms'), current.platforms], [t('최근 3개월', 'Last 90 days'), current.recent]] as const).map(([label, value]) => (
            <div key={label}><dt className="text-[13px] text-muted">{label}</dt><dd className="num mt-1 text-xl font-bold">{value}</dd></div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2 pt-5">
          <Link href={`/prd?opportunity=${encodeURIComponent(current.slug)}`} className="btn h-11 px-4">{t('이 문제로 PRD 만들기', 'Make a PRD from this')}</Link>
          <Link href={`/opportunities/${current.slug}`} className="btn-quiet h-11 px-4">{t('자세히', 'Details')}</Link>
        </div>
      </article>
    </div>
  );
}
