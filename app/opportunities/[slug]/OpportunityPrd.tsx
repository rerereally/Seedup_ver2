'use client';

import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';

export default function OpportunityPrd({ title, evidenceIds, ready, slug }: { title: string; evidenceIds: string[]; ready: boolean; slug: string }) {
  return (
    <section className="rounded-[20px] bg-[#fbfbfa] p-5 text-[#111113]">
      <h2 className="text-lg font-extrabold">이 기회로 시작하기</h2>
      <p className="mt-1 text-sm leading-6 text-[#4d4d55]">
        {ready ? '위 증언만 근거로 PRD를 만들고, AI 코딩 도구에 바로 넘길 수 있습니다.' : '근거 기준을 통과한 기회만 PRD로 만들 수 있습니다.'}
      </p>
      <PrdBuilder title={title} evidenceIds={evidenceIds} ready={ready} loginNext={`/opportunities/${slug}`} />
    </section>
  );
}
