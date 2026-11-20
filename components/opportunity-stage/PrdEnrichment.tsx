'use client';

import { useId, useState, useTransition } from 'react';
import { translator, type Lang } from '@/lib/i18n';
import { moduleEntries, MODULE_HEADING } from '@/lib/opportunities/prd-modules';
import type { WorkspaceQuestion } from '@/lib/opportunities/questions';
import type { Spec } from '@/lib/opportunities/spec';

export type PrdResearchRound = { questions: WorkspaceQuestion[]; filled: number; remaining: number };
export type PrdGapAnswer = { key: string; answer: string };

const chip = 'min-h-10 rounded-2xl border border-outline-soft px-3.5 py-2 text-left text-[13px] leading-5 text-tertiary hover:border-outline-strong hover:text-ink disabled:opacity-50';

export function PrdEnrichment({ lang, busy, round, start, apply }: {
  lang: Lang;
  busy: boolean;
  round: PrdResearchRound | null;
  start: () => Promise<void>;
  apply: (answers: PrdGapAnswer[]) => Promise<void>;
}) {
  const t = translator(lang);
  const fieldId = useId();
  const [answers, setAnswers] = useState<PrdGapAnswer[]>([]);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const disabled = busy || pending;
  const current = round?.questions[answers.length];
  const answer = (value: string) => {
    if (disabled || !current) return;
    setAnswers((previous) => [...previous, { key: current.key, answer: value.trim() }]);
    setText('');
  };

  return (
    <section aria-label={t('PRD 보강', 'PRD enrichment')} className="rounded-xl border border-outline-soft p-4">
      {!current && <button type="button" className="btn-quiet" disabled={disabled} onClick={() => startTransition(start)}>{t('빈 곳 채우기', 'Fill gaps')}</button>}
      {pending && <p role="status" className="mt-2 text-sm text-muted">{t('PRD를 보강하고 있습니다.', 'Updating the PRD.')}</p>}
      {round && (
        <p role="status" className={`text-sm text-muted ${!current ? 'mt-2' : ''}`}>
          {t(`원문으로 ${round.filled}곳을 채웠습니다. 확인할 항목이 ${round.remaining}개 남았습니다.`, `Filled ${round.filled} with source quotes. ${round.remaining} still need an answer.`)}
        </p>
      )}
      {round?.questions.slice(0, answers.length).map((question, index) => (
        <div key={question.key} className="mt-3 rounded-xl bg-surface-low px-3 py-2 text-sm">
          <p className="font-medium">{question.text}</p>
          <p className="mt-1 break-words text-muted">{answers[index].answer || t('건너뜀', 'Skipped')}</p>
        </div>
      ))}
      {current && (
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); if (text.trim()) answer(text); }}>
          <label htmlFor={fieldId} className="block font-semibold text-ink">{current.text}</label>
          {current.hint && <p className="text-[13px] text-muted">{current.hint}</p>}
          <div className="flex flex-wrap gap-1.5">
            {current.chips.map((label) => <button type="button" className={chip} key={label} disabled={disabled} onClick={() => answer(label)}>{label}</button>)}
            <button type="button" className={chip} disabled={disabled} onClick={() => answer('')}>{t('잘 모르겠어요', 'Not sure')}</button>
            <button type="button" className={`${chip} border-dashed`} disabled={disabled} onClick={() => answer('')}>{t('건너뛰기', 'Skip')}</button>
          </div>
          <div className="flex gap-2">
            <textarea id={fieldId} rows={2} value={text} maxLength={240} disabled={disabled} onChange={(event) => setText(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-field bg-white px-3 py-2 text-sm" />
            <button type="submit" className="btn-quiet self-end" disabled={disabled || !text.trim()}>{t('답하기', 'Answer')}</button>
          </div>
        </form>
      )}
      {!current && answers.some((row) => row.answer) && (
        <button type="button" className="btn mt-3" disabled={disabled} onClick={() => startTransition(() => apply(answers))}>{t('답변으로 PRD 수정', 'Update PRD with answers')}</button>
      )}
    </section>
  );
}

export function PrdModuleSection({ spec, lang, pick }: { spec: Spec; lang: Lang; pick: (id: string) => void }) {
  const t = translator(lang);
  return (
    <section>
      <h4 id="prd-modules" className="scroll-mt-24 text-xl font-bold tracking-tight">{t(...MODULE_HEADING)}</h4>
      {moduleEntries(spec, lang).map(({ id, title, reason, entries }) => (
        <div key={id} className="mt-4">
          <h5 className="text-sm font-semibold">{title}</h5>
          {reason && <p className="mt-1 break-words text-sm text-muted">{reason}</p>}
          <dl className="mt-2 divide-y divide-outline-soft">
            {entries.map(({ key, label, item, id, status }) => (
              <div key={key} className="py-2">
                <dt className="font-medium">{label}</dt>
                <dd className="break-words text-sm leading-6 text-tertiary">
                  {item?.evidence ? <button type="button" className="mr-2 font-semibold text-seed underline underline-offset-4" onClick={() => pick(id)}>{id} · {status}</button> :
                    <span className="mr-2 text-xs text-muted">{id} · {status}</span>}
                  {item?.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
