import Link from 'next/link';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { PLATFORM_LABELS, localizedOpportunity } from '@/lib/opportunities/types';
import type { Evidence, Opportunity } from '@/lib/opportunities/types';

/** One quote per platform, so the first step shows the complaint arriving from different places. */
function spreadQuotes(evidence: Evidence[], count: number) {
  const seen = new Set<string>();
  const picked = evidence.filter((item) => !seen.has(item.platform) && seen.add(item.platform));
  return [...picked, ...evidence.filter((item) => !picked.includes(item))].slice(0, count);
}

/**
 * The home page's "how it works", told with a real opportunity from the current run:
 * scattered complaints → one problem → checked against the market → a PRD line that points back to its quotes.
 */
export default function EvidenceStory({ opportunities, lang }: { opportunities: Opportunity[]; lang: Lang }) {
  const t = translator(lang);
  const lead = opportunities.find((item) => item.qualified && item.platforms.length > 1) ?? opportunities[0];
  if (!lead?.evidence.length) return null;
  const { name, problem } = localizedOpportunity(lead, lang);
  const quotes = spreadQuotes(lead.evidence, 3);
  const quoteText = (item: Evidence) => (lang === 'en' ? item.quote : item.quoteKo || item.quote);

  const steps = [
    { title: t('흩어진 불만', 'Scattered complaints'), body: t('개발자들이 여러 곳에 남긴 말입니다. 따로 보면 그냥 푸념입니다.', 'What developers said in different places. Alone, each is just a gripe.') },
    { title: t('하나의 문제로', 'One problem'), body: t('같은 문제를 말하는 증언끼리 묶습니다.', 'Quotes about the same problem are grouped together.') },
    { title: t('바깥에서 검증', 'Checked outside'), body: t('원문과 글자 단위로 대조하고, 이미 푼 도구가 있는지 찾아봅니다.', 'Each quote is matched to its source, and existing tools are searched.') },
    { title: t('근거가 붙은 PRD', 'A PRD with sources'), body: t('요구사항 한 줄마다 그 말을 한 사람의 원문이 붙습니다.', 'Every requirement carries the quotes it came from.') },
  ];

  return (
    <section className="page-shell" aria-labelledby="story-heading">
      <p className="label">{t('Seedup이 하는 일', 'What Seedup does')}</p>
      <h2 id="story-heading" className="page-intro-title mt-2 max-w-[18em]">
        {t('AI는 코드를 빨리 짜 줍니다. 무엇을 만들지는 사람들의 말이 정합니다.', 'AI writes the code fast. What to build is decided by what people say.')}
      </h2>
      <p className="page-intro-description">{t(`이번 실행에서 실제로 찾은 기회 "${name}"이 거친 과정입니다.`, `The path one real opportunity from this run, "${name}", went through.`)}</p>

      <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex min-w-0 flex-col rounded-[20px] border border-outline-soft bg-[rgba(255,255,255,.03)] p-5">
            <span className="num text-sm text-muted">0{index + 1}</span>
            <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
            <div className="mt-5 grid grow content-end gap-2">
              {index === 0 && quotes.map((item, i) => (
                <p key={item.id} className="rounded-xl bg-[rgba(255,255,255,.06)] px-3 py-2 text-[13px] leading-5" style={{ transform: `rotate(${[-1.5, 1.2, -0.6][i]}deg)` }}>
                  <span className="block text-[11px] text-muted">{PLATFORM_LABELS[item.platform]}</span>
                  <span className="line-clamp-2">{quoteText(item)}</span>
                </p>
              ))}
              {index === 1 && (
                <div className="rounded-xl bg-[rgba(255,255,255,.06)] p-3">
                  <p className="font-bold leading-6">{name}</p>
                  <p className="mt-1 text-[13px] text-muted">{t(`증언 ${lead.evidence.length}건 · 플랫폼 ${lead.platforms.length}종`, `${lead.evidence.length} quotes · ${lead.platforms.length} platforms`)}</p>
                </div>
              )}
              {index === 2 && (
                <ul className="grid gap-1.5 text-[13px]">
                  <li className="rounded-xl bg-[rgba(255,255,255,.06)] px-3 py-2">✓ {t('원문 대조 통과', 'Matched to source')} <span className="num text-muted">{lead.evidence.length}/{lead.evidence.length}</span></li>
                  <li className="rounded-xl bg-[rgba(255,255,255,.06)] px-3 py-2">✓ {t('직접 경쟁 도구', 'Direct rivals')} <span className="num text-muted">{lead.directCount}</span></li>
                </ul>
              )}
              {index === 3 && (
                <div className="rounded-xl bg-[#fbfbfa] p-3 text-[13px] leading-5 text-[#111113]">
                  <p><b>R-01</b> <span className="line-clamp-2">{problem}</span></p>
                  <p className="mt-2 flex flex-wrap gap-1">
                    {quotes.map((item, i) => <span key={item.id} className="rounded-md bg-[#ececee] px-1.5 py-0.5 text-[11px] font-bold text-[#4d4d55]">E-{i + 1} · {PLATFORM_LABELS[item.platform]}</span>)}
                  </p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Link href={`/prd?opportunity=${encodeURIComponent(lead.slug)}`} className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink hover:underline">
        {t('이 기회로 PRD 만들어 보기', 'Build a PRD from this opportunity')} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
