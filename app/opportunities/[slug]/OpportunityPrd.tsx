import Link from 'next/link';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

/** Sidebar entry to the full-width PRD workspace (/prd), plus a bar above the tab bar on phones. */
export default function OpportunityPrd({ ready, slug, evidenceCount, lang = 'ko' }: { ready: boolean; slug: string; evidenceCount: number; lang?: Lang }) {
  const t = translator(lang);
  const href = `/prd?opportunity=${encodeURIComponent(slug)}`;
  const label = ready ? t('이 문제로 PRD 만들기', 'Build a PRD for this problem') : t('가설 초안 PRD 만들기', 'Build a hypothesis-draft PRD');
  return (
    <>
      <section className="card p-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('다음 단계: 설계', 'Next step: design')}</h2>
        <p className="mt-2 text-sm leading-7 text-tertiary">
          {ready
            ? t(`이 원문 ${evidenceCount}건만 근거로 PRD를 만듭니다. 원문이 받쳐 주지 않는 요구사항은 가설로 남습니다. AGENTS.md·CLAUDE.md로 코딩 에이전트에 넘길 수 있습니다.`, `The PRD is built only from these ${evidenceCount} quotes. Requirements no quote backs stay as hypotheses. Hand it to coding agents as AGENTS.md or CLAUDE.md.`)
            : t('근거가 아직 기준에 못 미쳐, 검증 전 가설 초안으로 만듭니다. 원문이 더 모이면 검증된 PRD로 바뀝니다.', 'The evidence is below the bar, so this makes an unverified hypothesis draft. It becomes a verified PRD as more quotes arrive.')}
        </p>
        <Link href={href} className="btn mt-5 h-12 w-full text-[15px]">{label}</Link>
      </section>
      {/* On phones the sidebar sits below a long article, so the main action also stays reachable just above the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-outline-soft bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href={href} className="btn h-11 w-full">{label}</Link>
      </div>
    </>
  );
}
