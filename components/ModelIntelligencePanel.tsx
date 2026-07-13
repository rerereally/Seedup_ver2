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
    <section className="min-w-0 border-t border-outline-soft p-4 first:border-t-0 lg:border-l lg:first:border-l-0 lg:border-t-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-black text-ink">{title}</h3>
      </div>
      <div className="mt-4 grid gap-2">
        {models.length ? models.slice(0, 5).map((model, index) => (
          <div key={model.model_id} className="flex min-w-0 items-center gap-3 border border-outline-soft bg-surface px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-ink text-xs font-black text-white">{model[rankKey] ?? index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{modelLabel(model)}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase text-muted">{model.provider}</p>
            </div>
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
    <section className="border border-outline-soft bg-white">
      <div className="flex flex-col gap-3 border-b border-outline-soft p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted"><BrainCircuit className="h-4 w-4" /> Model Intelligence</div>
          <h2 className="mt-2 text-2xl font-black text-ink">지금 많이 쓰는 AI와 성능 신호</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">사용량, 외부 지능 지수, 사람 선호도는 서로 다른 지표입니다. 목적에 맞게 비교하세요.</p>
        </div>
        <p className="text-xs font-bold uppercase text-muted">OpenRouter · {snapshotDate ?? '수집 대기'}</p>
      </div>
      <div className="grid lg:grid-cols-3">
        <RankList title="가장 많이 쓰는 모델" icon={UsersRound} models={popular} rankKey="popularity_rank" empty="OpenRouter 주간 사용량을 수집하면 표시됩니다." />
        <RankList title="지능 지수 상위" icon={BrainCircuit} models={intelligence} rankKey="intelligence_rank" empty="Artificial Analysis 지수 데이터를 기다리고 있습니다." />
        <RankList title="Design Arena 상위" icon={Trophy} models={arena} rankKey="arena_rank" empty="Design Arena ELO 데이터를 기다리고 있습니다." />
      </div>
      {models.length > 0 && <div className="flex items-center gap-2 border-t border-outline-soft bg-surface px-5 py-3 text-xs leading-5 text-muted"><Gauge className="h-4 w-4 shrink-0" /> 사용량은 OpenRouter의 최근 7일 처리 토큰 기준이며, 성능은 OpenRouter에 표시된 외부 벤치마크 순위입니다.</div>}
    </section>
  );
}
