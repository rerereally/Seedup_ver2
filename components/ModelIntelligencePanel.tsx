import type { ModelIntelligence } from '@/lib/data';
import { modelComposite, type Period } from '@/lib/popularity';
import { BrainCircuit, Gauge, Trophy, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';

/** Rows each ranking shows before "더 보기"; collection keeps the top 20 of each. */
const SHOWN = 10;

function modelLabel(model: ModelIntelligence) {
  // OpenRouter names start with "Provider: ", which the row already shows on the right.
  return (model.model_name || model.model_id).replace(/^[^:]{1,40}:\s+/, '');
}

/** Places a model climbed in the usage ranking since the period's first day; a model new to the list says so. */
function Climb({ model, period, baseline }: { model: ModelIntelligence; period: Period; baseline: Map<string, number> }) {
  const before = baseline.get(model.model_id);
  if (!before) return <span className="shrink-0 text-[12px] text-seed">{period.label} 새로 진입</span>;
  const climb = before - Number(model.popularity_rank);
  if (!climb) return null;
  return <span className={`num shrink-0 text-[12px] ${climb > 0 ? 'text-seed' : 'text-muted'}`}>{climb > 0 ? '▲' : '▼'}{Math.abs(climb)}</span>;
}

function RankList({ title, icon: Icon, models, rankKey, empty, climb }: {
  climb?: (model: ModelIntelligence) => ReactNode;
  title: string;
  icon: typeof UsersRound;
  models: ModelIntelligence[];
  rankKey: 'popularity_rank' | 'intelligence_rank' | 'arena_rank';
  empty: string;
}) {
  const row = (model: ModelIntelligence, index: number) => (
    <div key={model.model_id} className="flex min-w-0 items-baseline gap-3 border-t border-outline-soft py-2.5 first:border-t-0">
      <span className="num w-5 shrink-0 text-sm text-muted">{model[rankKey] ?? index + 1}</span>
      <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{modelLabel(model)}</p>
      {climb?.(model)}
      <p className="shrink-0 text-[13px] text-muted">{model.provider}</p>
    </div>
  );
  return (
    <section className="min-w-0 border-t border-outline-soft py-5 first:border-t-0 lg:border-l lg:border-t-0 lg:px-6 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
        <h3 className="label">{title}</h3>
      </div>
      <div className="mt-2">
        {models.length ? (
          <>
            {models.slice(0, SHOWN).map(row)}
            {/* The rest of the collected ranking opens in place; <details> needs no client script. */}
            {models.length > SHOWN && (
              <details className="group">
                <summary className="link-seed cursor-pointer list-none border-t border-outline-soft pt-2.5"><span className="group-open:hidden">{models.length - SHOWN}개 더 보기</span><span className="hidden group-open:inline">접기</span></summary>
                <div className="mt-1">{models.slice(SHOWN).map(row)}</div>
              </details>
            )}
          </>
        ) : <p className="py-4 text-sm leading-6 text-muted">{empty}</p>}
      </div>
    </section>
  );
}

/** Models ranked on usage and performance together, with the places behind each score. */
function Overall({ models }: { models: ModelIntelligence[] }) {
  const ranked = modelComposite(models).slice(0, SHOWN);
  if (!ranked.length) return null;
  const place = (label: string, rank: number | null) => (rank ? `${label} ${rank}위` : null);
  return (
    <section className="border-b border-outline-soft py-5">
      <h3 className="text-[17px] font-bold tracking-[-0.015em] text-ink">종합 순위</h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">사용량 순위와 성능 순위(지능 지수 70%, Design Arena 30%)를 반씩 합친 100점 만점 점수입니다. 두 쪽 모두 상위권이어야 높습니다.</p>
      <ol className="mt-3 grid gap-x-8 md:grid-cols-2">
        {ranked.map(({ model, score }, index) => (
          <li key={model.model_id} className="flex min-w-0 items-baseline gap-3 border-t border-outline-soft py-2.5">
            <span className="num w-5 shrink-0 text-sm text-muted">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{modelLabel(model)}</span>
              <span className="block truncate text-[12px] text-muted">{[model.provider, place('사용량', model.popularity_rank), place('지능', model.intelligence_rank), place('Arena', model.arena_rank)].filter(Boolean).join(' · ')}</span>
            </span>
            <span className={`num shrink-0 text-[15px] font-semibold ${index === 0 ? 'text-seed' : 'text-ink'}`}>{score}<span className="sr-only">점</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `period`: a period is chosen, so the usage list also shows how far each model climbed since its first day. */
export default function ModelIntelligencePanel({ models, period = null, baseline }: { models: ModelIntelligence[]; period?: Period | null; baseline?: Map<string, number> }) {
  const popular = models.filter((model) => model.popularity_rank !== null).sort((left, right) => Number(left.popularity_rank) - Number(right.popularity_rank));
  const intelligence = models.filter((model) => model.intelligence_rank !== null).sort((left, right) => Number(left.intelligence_rank) - Number(right.intelligence_rank));
  const arena = models.filter((model) => model.arena_rank !== null).sort((left, right) => Number(left.arena_rank) - Number(right.arena_rank));
  const snapshotDate = models[0]?.snapshot_date;

  return (
    <section>
      <div className="flex flex-col gap-3 border-b border-outline-soft pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">지금 많이 쓰는 모델과 성능 순위</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">사용량, 외부 지능 지수, 사람 선호도는 서로 다른 지표입니다. 목적에 맞게 비교하세요.</p>
        </div>
        <p className="shrink-0 text-[13px] text-muted">OpenRouter, {snapshotDate ?? '수집 대기'}</p>
      </div>
      <Overall models={models} />
      <div className="grid lg:grid-cols-3">
        <RankList title={period ? `가장 많이 쓰는 모델, ${period.label} 전과 비교` : '가장 많이 쓰는 모델'} icon={UsersRound} models={popular} rankKey="popularity_rank" empty="OpenRouter 주간 사용량을 수집하면 표시됩니다." climb={period && baseline ? (model) => <Climb model={model} period={period} baseline={baseline} /> : undefined} />
        <RankList title="지능 지수 상위" icon={BrainCircuit} models={intelligence} rankKey="intelligence_rank" empty="Artificial Analysis 지수 데이터를 기다리고 있습니다." />
        <RankList title="Design Arena 상위" icon={Trophy} models={arena} rankKey="arena_rank" empty="Design Arena ELO 데이터를 기다리고 있습니다." />
      </div>
      {models.length > 0 && <div className="flex items-center gap-2 border-t border-outline-soft py-4 text-[13px] leading-5 text-muted"><Gauge aria-hidden="true" className="h-4 w-4 shrink-0" /> 사용량은 OpenRouter의 최근 7일 처리 토큰 기준이며, 성능은 OpenRouter에 표시된 외부 벤치마크 순위입니다.</div>}
    </section>
  );
}
