'use client';

import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

export default function OpportunityPrd({ title, evidenceIds, ready, slug, lang = 'ko' }: { title: string; evidenceIds: string[]; ready: boolean; slug: string; lang?: Lang }) {
  const t = translator(lang);
  return (
    <section className="rounded-[20px] bg-[#fbfbfa] p-5 text-[#111113]">
      <h2 className="text-lg font-extrabold">{t('이 기회로 시작하기', 'Start from this opportunity')}</h2>
      <p className="mt-1 text-sm leading-6 text-[#4d4d55]">
        {ready
          ? t('위 증언만 근거로 요구사항 → 기능 → 화면까지 이어진 PRD를 만들고, AI 코딩 도구에 바로 넘길 수 있습니다.', 'Turn only the quotes above into a PRD traced from requirements to features to screens, ready for AI coding tools.')
          : t('근거가 아직 기준에 못 미쳐, 검증 전 가설 초안으로 만듭니다. 증언이 더 모이면 검증된 PRD로 바뀝니다.', 'The evidence is below the bar, so this makes an unverified hypothesis draft. It becomes a verified PRD as more quotes arrive.')}
      </p>
      <PrdBuilder title={title} evidenceIds={evidenceIds} ready={ready} loginNext={`/opportunities/${slug}`} />
    </section>
  );
}
