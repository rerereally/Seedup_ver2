'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import type { Spec } from '@/lib/opportunities/spec';
import { MAX_CRITERIA, MIN_CRITERIA, criterion, goalDraft, unlinkedItems, type GoalDraft } from './draft';
import type { ProjectGoal, SuccessCriterion, Track } from './types';

type Save = 'idle' | 'saving' | 'saved' | 'unsaved' | 'login';
type Form = { statement: string; criteria: SuccessCriterion[]; inScope: string; outOfScope: string; track: Track | null; reason: string };

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);
const goalUrl = (key: string) => `/api/projects/${encodeURIComponent(key)}/goal`;
const field = 'w-full rounded-lg border border-field bg-white px-3 text-[15px] leading-6 placeholder:text-muted';
// B1's route may answer with the goal itself or wrapped as { goal }; anything without a statement is no goal.
const readGoal = (json: unknown): ProjectGoal | null => {
  const found = (json as { goal?: unknown } | null)?.goal ?? json;
  return typeof (found as ProjectGoal | null)?.statement === 'string' ? (found as ProjectGoal) : null;
};
const toForm = (from: GoalDraft, track: Track | null): Form => ({ statement: from.statement, criteria: from.criteria, inScope: from.inScope.join('\n'), outOfScope: from.outOfScope.join('\n'), track, reason: '' });

/**
 * The goal card on the planning tab: a draft from the PRD's goals, metrics and non-goals that the maker edits and locks,
 * the track they pick, and the requirements and features no success criterion covers. Saving needs a project key
 * (`prd:<id>`); without one, or while the goal API is not deployed, the lock stays on this screen marked as not saved.
 */
export default function GoalLock({ spec, idea, projectKey, onLocked }: { spec: Spec; idea: string; projectKey: string | null; onLocked?: () => void }) {
  const lang = useLang();
  const t = translator(lang);
  const [goal, setGoal] = useState<ProjectGoal | null>(null);
  const [save, setSave] = useState<Save>('idle');
  // The open form; null shows the locked card. It starts as the PRD draft so the first thing seen is something to lock.
  const [form, setForm] = useState<Form | null>(() => toForm(goalDraft(spec, idea), null));
  const [error, setError] = useState('');

  // A goal locked earlier for this PRD; 404 means none yet, and any failure leaves the draft to work from.
  useEffect(() => {
    if (!projectKey) return;
    let live = true;
    fetch(goalUrl(projectKey))
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const found = readGoal(json);
        if (live && found) {
          setGoal(found);
          onLocked?.();
          setForm(null);
          setSave('saved');
        }
      })
      .catch(() => undefined);
    return () => { live = false; };
    // onLocked only reports upward; a new callback identity must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  const editing = form;
  const update = (patch: Partial<Form>) => setForm((before) => before && { ...before, ...patch });
  const setCriterion = (index: number, patch: Partial<SuccessCriterion>) => update({ criteria: editing!.criteria.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  const criteria = editing?.criteria ?? goal?.criteria;
  const unlinked = useMemo(() => unlinkedItems(spec, criteria ?? []), [spec, criteria]);

  const put = async (next: ProjectGoal) => {
    if (!projectKey) return setSave('unsaved');
    setSave('saving');
    try {
      const { statement, criteria: rows, inScope, outOfScope, track, changeReason } = next;
      const response = await fetch(goalUrl(projectKey), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statement, criteria: rows, inScope, outOfScope, track, changeReason }) });
      if (response.status === 401) return setSave('login');
      if (!response.ok) return setSave('unsaved');
      const saved = readGoal(await response.json().catch(() => null));
      if (saved) setGoal(saved);
      setSave('saved');
    } catch {
      setSave('unsaved');
    }
  };

  const lock = () => {
    if (!editing) return;
    const rows = editing.criteria.filter((row) => row.text.trim() || row.measure.trim()).map((row, index) => ({ ...row, id: `G-${index + 1}`, text: row.text.trim(), measure: row.measure.trim() }));
    const problem = !editing.statement.trim() ? t('목표 문장을 적어 주세요.', 'Write the goal statement.')
      : !editing.track ? t('트랙을 골라 주세요.', 'Pick a track.')
      : rows.length < MIN_CRITERIA || rows.length > MAX_CRITERIA ? t(`성공 기준은 ${MIN_CRITERIA}~${MAX_CRITERIA}개여야 합니다.`, `Keep ${MIN_CRITERIA} to ${MAX_CRITERIA} success criteria.`)
      : rows.some((row) => !row.text || !row.measure) ? t('성공 기준마다 내용과 재는 방법을 모두 적어 주세요.', 'Give every criterion both what and how it is measured.')
      : goal && !editing.reason.trim() ? t('목표를 바꾸는 이유를 적어 주세요.', 'Say why the goal changes.')
      : '';
    if (problem) return setError(problem);
    const next: ProjectGoal = {
      projectKey: projectKey ?? '',
      version: (goal?.version ?? 0) + 1,
      track: editing.track!,
      statement: editing.statement.trim(),
      criteria: rows,
      inScope: lines(editing.inScope),
      outOfScope: lines(editing.outOfScope),
      lockedAt: new Date().toISOString(),
      changeReason: goal ? editing.reason.trim() : null,
    };
    setGoal(next);
    onLocked?.();
    setForm(null);
    setError('');
    void put(next);
  };

  const status: Record<SuccessCriterion['status'], string> = { open: t('미착수', 'Not started'), partial: t('일부', 'Partly met'), met: t('충족', 'Met') };
  const saveText: Record<Save, string> = {
    idle: '',
    saving: t('저장 중', 'Saving'),
    saved: t('저장됨', 'Saved'),
    unsaved: t('아직 저장되지 않음', 'Not saved yet'),
    login: t('로그인하면 저장됩니다', 'Sign in to save'),
  };
  const tracks: Array<[Track, string, string]> = [
    ['personal', t('A 개인용', 'A Personal'), t('내가 쓰는 내부 툴, 자동화', 'An internal tool or automation for you')],
    ['launch', t('B 출시용', 'B Launch'), t('외부 사용자에게 내놓을 제품', 'A product for outside users')],
  ];

  const unlinkedSection = unlinked.length > 0 && (
    <div className="border-t border-outline-soft px-5 py-4">
      <h3 className="text-[15px] font-semibold text-ink">{t(`목표와 무관한 항목 ${unlinked.length}개`, `${unlinked.length} items unrelated to the goal`)}</h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">{t('어느 성공 기준과도 이어지지 않습니다. 기준에 잇거나, PRD에서 빼거나, 하지 않는 것으로 옮기세요.', 'No success criterion covers these. Tie them to one, drop them from the PRD, or move them out of scope.')}</p>
      <ul className="mt-2 space-y-1 text-[14px] leading-6">
        {unlinked.map((row) => (
          <li key={row.id} className="flex min-w-0 gap-2"><span className="shrink-0 font-mono text-[13px] text-muted">{row.id}</span><span className="min-w-0 break-words text-tertiary">{row.title}</span></li>
        ))}
      </ul>
    </div>
  );

  if (!editing && goal) {
    return (
      <section aria-labelledby="goal-title" className="card mb-8 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4">
          <h2 id="goal-title" className="text-[17px] font-semibold text-ink">{t('잠긴 목표', 'Locked goal')}</h2>
          <span className="chip">{tracks.find(([key]) => key === goal.track)?.[1]}</span>
          <span className="num text-[13px] text-muted">v{goal.version} · {new Date(goal.lockedAt).toLocaleDateString(lang === 'en' ? 'en' : 'ko')}</span>
          {save !== 'idle' && <span role="status" className={`text-[13px] ${save === 'saved' ? 'text-seed' : 'text-muted'}`}>{saveText[save]}</span>}
        </div>
        <p className="break-words px-5 pt-2 text-[17px] leading-7 text-ink">{goal.statement}</p>
        {goal.changeReason && <p className="break-words px-5 pt-1 text-[13px] text-muted">{t('바꾼 이유', 'Why it changed')}: {goal.changeReason}</p>}
        <ol className="mt-4 border-t border-outline-soft px-5 py-3">
          {goal.criteria.map((row) => (
            <li key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 py-1.5 text-[14px] leading-6">
              <span className="font-mono text-[13px] leading-6 text-muted">{row.id}</span>
              <span className="min-w-0 break-words"><span className="text-ink">{row.text}</span><span className="block text-[13px] text-muted">{row.measure}</span></span>
              <span className={`text-[13px] ${row.status === 'met' ? 'font-semibold text-seed' : 'text-muted'}`}>{status[row.status]}</span>
            </li>
          ))}
        </ol>
        <div className="grid gap-4 border-t border-outline-soft px-5 py-4 sm:grid-cols-2">
          {([[t('포함 범위', 'In scope'), goal.inScope], [t('하지 않는 것', 'Out of scope'), goal.outOfScope]] as const).map(([label, rows]) => (
            <div key={label} className="min-w-0">
              <h3 className="label">{label}</h3>
              {rows.length
                ? <ul className="mt-1 list-disc space-y-0.5 break-words pl-5 text-[14px] leading-6 text-tertiary">{rows.map((row) => <li key={row}>{row}</li>)}</ul>
                : <p className="mt-1 text-[14px] text-muted">{t('없음', 'None')}</p>}
            </div>
          ))}
        </div>
        {unlinkedSection}
        <div className="flex flex-wrap items-center gap-2 border-t border-outline-soft px-5 py-3">
          <button type="button" className="btn-quiet h-10" onClick={() => { setForm(toForm(goal, goal.track)); setError(''); }}>{t('목표 바꾸기', 'Change the goal')}</button>
          {(save === 'unsaved' || save === 'login') && projectKey && <button type="button" className="btn-quiet h-10" onClick={() => void put(goal)}>{t('다시 저장', 'Save again')}</button>}
          {save === 'unsaved' && <p className="text-[13px] leading-5 text-muted">{projectKey ? t('서버에 저장하지 못해 이 화면에만 있습니다.', 'The server did not take it; it lives on this screen only.') : t('이 PRD의 프로젝트 키를 아직 받지 못해 이 화면에만 있습니다.', 'This PRD has no project key yet, so it lives on this screen only.')}</p>}
        </div>
      </section>
    );
  }

  if (!editing) return null;
  return (
    <section aria-labelledby="goal-title" className="card mb-8 min-w-0">
      <form onSubmit={(event) => { event.preventDefault(); lock(); }} noValidate>
        <div className="px-5 pt-4">
          <h2 id="goal-title" className="text-[17px] font-semibold text-ink">{goal ? t('목표 바꾸기', 'Change the goal') : t('목표 잠그기', 'Lock the goal')}</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">{t('PRD에서 초안을 채웠습니다. 다듬어 잠그면 에이전트가 이 목표를 기준으로 일합니다.', 'Drafted from the PRD. Edit and lock it; agents then work toward this goal.')}</p>
        </div>

        <div className="px-5 pt-4">
          <label htmlFor="goal-statement" className="text-[14px] font-semibold text-ink">{t('목표 문장', 'Goal statement')}</label>
          <p className="text-[13px] text-muted">{t('누구의 어떤 문제를 어떤 결과로 풀지 한 문장으로', 'Whose problem, solved with what result, in one sentence')}</p>
          <textarea id="goal-statement" rows={2} maxLength={300} value={editing.statement} onChange={(event) => update({ statement: event.target.value })} className={`${field} mt-2 block py-2 [field-sizing:content]`} />
        </div>

        <fieldset className="px-5 pt-4">
          <legend className="text-[14px] font-semibold text-ink">{t('트랙', 'Track')}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {tracks.map(([key, label, hint]) => (
              <label key={key} className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${editing.track === key ? 'border-ink' : 'border-outline-soft hover:border-outline-strong'}`}>
                <input type="radio" name="goal-track" value={key} checked={editing.track === key} onChange={() => update({ track: key })} className="mt-1 h-4 w-4 shrink-0 accent-seed" />
                <span className="min-w-0"><span className="block text-[14px] font-semibold text-ink">{label}</span><span className="block text-[13px] text-muted">{hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="px-5 pt-4">
          <legend className="text-[14px] font-semibold text-ink">{t(`성공 기준 ${MIN_CRITERIA}~${MAX_CRITERIA}개`, `${MIN_CRITERIA} to ${MAX_CRITERIA} success criteria`)}</legend>
          <ol className="mt-2 space-y-3">
            {editing.criteria.map((row, index) => (
              <li key={index} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
                <span className="pt-2 font-mono text-[13px] text-muted">G-{index + 1}</span>
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <input aria-label={t(`성공 기준 ${index + 1}`, `Criterion ${index + 1}`)} value={row.text} maxLength={200} onChange={(event) => setCriterion(index, { text: event.target.value })} placeholder={t('무엇이 되면 성공인가', 'What counts as success')} className={`${field} h-10`} />
                  <div className="flex min-w-0 gap-2">
                    <input aria-label={t(`재는 방법 ${index + 1}`, `How to measure ${index + 1}`)} value={row.measure} maxLength={200} onChange={(event) => setCriterion(index, { measure: event.target.value })} placeholder={t('어떻게 잴까 (예: 3분 안에 완료)', 'How to measure (e.g. done in 3 min)')} className={`${field} h-10 min-w-0`} />
                    {editing.criteria.length > MIN_CRITERIA && <button type="button" onClick={() => update({ criteria: editing.criteria.filter((_, i) => i !== index) })} className="h-10 shrink-0 rounded-lg px-2 text-[13px] text-muted hover:bg-surface-low hover:text-ink">{t('빼기', 'Remove')}<span className="sr-only"> G-{index + 1}</span></button>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {editing.criteria.length < MAX_CRITERIA && <button type="button" onClick={() => update({ criteria: [...editing.criteria, criterion(editing.criteria.length)] })} className="link-seed mt-2">{t('기준 더하기', 'Add a criterion')}</button>}
        </fieldset>

        <div className="grid gap-4 px-5 pt-4 sm:grid-cols-2">
          {([['goal-in', t('포함 범위', 'In scope'), 'inScope'], ['goal-out', t('하지 않는 것', 'Out of scope'), 'outOfScope']] as const).map(([id, label, key]) => (
            <div key={id} className="min-w-0">
              <label htmlFor={id} className="text-[14px] font-semibold text-ink">{label}</label>
              <p className="text-[13px] text-muted">{t('한 줄에 하나씩', 'One per line')}</p>
              <textarea id={id} rows={4} maxLength={2000} value={editing[key]} onChange={(event) => update({ [key]: event.target.value })} className={`${field} mt-2 block py-2`} />
            </div>
          ))}
        </div>

        {goal && (
          <div className="px-5 pt-4">
            <label htmlFor="goal-reason" className="text-[14px] font-semibold text-ink">{t('바꾸는 이유', 'Why it changes')}</label>
            <input id="goal-reason" value={editing.reason} maxLength={300} onChange={(event) => update({ reason: event.target.value })} className={`${field} mt-2 h-10`} />
          </div>
        )}

        {unlinkedSection && <div className="mt-4">{unlinkedSection}</div>}

        <div className="flex flex-wrap items-center gap-2 border-t border-outline-soft px-5 py-3 mt-4">
          <button type="submit" className="btn h-10">{goal ? t('새 버전으로 잠그기', 'Lock as a new version') : t('목표 잠그기', 'Lock the goal')}</button>
          {goal && <button type="button" className="btn-quiet h-10" onClick={() => { setForm(null); setError(''); }}>{t('취소', 'Cancel')}</button>}
          {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}
        </div>
      </form>
    </section>
  );
}
