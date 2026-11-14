import Link from 'next/link';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

/** Sidebar entry to the full-width PRD workspace (/prd), plus a bar fixed to the bottom on phones. */
export default function OpportunityPrd({ ready, slug, evidenceCount, lang = 'ko' }: { ready: boolean; slug: string; evidenceCount: number; lang?: Lang }) {
  const t = translator(lang);
  const href = `/prd?opportunity=${encodeURIComponent(slug)}`;
  const label = ready ? t('근거 추적 PRD 만들기', 'Build an evidence-traced PRD') : t('가설 초안 PRD 만들기', 'Build a hypothesis-draft PRD');
  return (
    <>
      <section className="rounded-[20px] bg-[#fbfbfa] p-5 text-[#111113]">
        <h2 className="text-lg font-extrabold">{t('이 기회로 시작하기', 'Start from this opportunity')}</h2>
        <p className="mt-1 text-sm leading-6 text-[#4d4d55]">
          {ready
            ? t(`증언 ${evidenceCount}건만 근거로 요구사항 → 기능 → 화면까지 이어진 PRD를 만들고, AGENTS.md·CLAUDE.md로 AI 코딩 도구에 넘깁니다.`, `Turn only these ${evidenceCount} quotes into a PRD traced from requirements to features to screens, then hand it to AI coding tools as AGENTS.md or CLAUDE.md.`)
            : t('근거가 아직 기준에 못 미쳐, 검증 전 가설 초안으로 만듭니다. 증언이 더 모이면 검증된 PRD로 바뀝니다.', 'The evidence is below the bar, so this makes an unverified hypothesis draft. It becomes a verified PRD as more quotes arrive.')}
        </p>
        <Link href={href} className="mt-4 flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#111113] px-4 text-base font-extrabold text-[#fbfbfa] transition-transform active:scale-[0.985]">
          {label} <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </section>
      {/* On phones the sidebar sits below a long article, so the main action also stays reachable at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-soft bg-surface/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <Link href={href} className="flex min-h-12 items-center justify-center rounded-full bg-ink text-[15px] font-extrabold text-white">
          {label}
        </Link>
      </div>
    </>
  );
}
