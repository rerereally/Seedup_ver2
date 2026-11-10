import type { ModelIntelligence } from '@/lib/data';
import { BrainCircuit, Gauge, Trophy, UsersRound } from 'lucide-react';

function modelLabel(model: ModelIntelligence) {
  return model.model_name || model.model_id;
}

function RankList({ title, icon: Icon, models, rankKey, empty }: {
  title: string;
  icon: typeof UsersRound;
  models: ModelIntelligence[];
  rankKey: 'popularity_rank' | 'intelligence_rank' | 'arena_rank';
  empty: string;
}) {
  return (
    <section className="min-w-0 border-t border-outline-soft p-5 first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
        <h3 className="label">{title}</h3>
      </div>
      <div className="mt-2">
        {models.length ? models.slice(0, 5).map((model, index) => (
          <div key={model.model_id} className="flex min-w-0 items-baseline gap-3 border-t border-outline-soft py-2.5 first:border-t-0">
            <span className="num w-4 shrink-0 text-sm text-muted">{model[rankKey] ?? index + 1}</span>
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{modelLabel(model)}</p>
            <p className="shrink-0 text-[13px] text-muted">{model.provider}</p>
          </div>
        )) : <p className="py-4 text-sm leading-6 text-muted">{empty}</p>}
      </div>
    </section>
  );
}

export default function ModelIntelligencePanel({ models }: { models: ModelIntelligence[] }) {
  const popular = models.filter((model) => model.popularity_rank !== null).sort((left, right) => Number(left.popularity_rank) - Number(right.popularity_rank));
  const intelligence = models.filter((model) => model.intelligence_rank !== null).sort((left, right) => Number(left.intelligence_rank) - Number(right.intelligence_rank));
  const arena = models.filter((model) => model.arena_rank !== null).sort((left, right) => Number(left.arena_rank) - Number(right.arena_rank));
  const snapshotDate = models[0]?.snapshot_date;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-outline-soft p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">지금 많이 쓰는 모델과 성능 순위</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">사용량, 외부 지능 지수, 사람 선호도는 서로 다른 지표입니다. 목적에 맞게 비교하세요.</p>
        </div>
        <p className="shrink-0 text-[13px] text-muted">OpenRouter · {snapshotDate ?? '수집 대기'}</p>
      </div>
      <div className="grid lg:grid-cols-3">
        <RankList title="가장 많이 쓰는 모델" icon={UsersRound} models={popular} rankKey="popularity_rank" empty="OpenRouter 주간 사용량을 수집하면 표시됩니다." />
        <RankList title="지능 지수 상위" icon={BrainCircuit} models={intelligence} rankKey="intelligence_rank" empty="Artificial Analysis 지수 데이터를 기다리고 있습니다." />
        <RankList title="Design Arena 상위" icon={Trophy} models={arena} rankKey="arena_rank" empty="Design Arena ELO 데이터를 기다리고 있습니다." />
      </div>
      {models.length > 0 && <div className="flex items-center gap-2 border-t border-outline-soft px-5 py-3 text-[13px] leading-5 text-muted"><Gauge aria-hidden="true" className="h-4 w-4 shrink-0" /> 사용량은 OpenRouter의 최근 7일 처리 토큰 기준이며, 성능은 OpenRouter에 표시된 외부 벤치마크 순위입니다.</div>}
    </section>
  );
}
