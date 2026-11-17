'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EXPORT_FILES, SLOT_KEYS, slotLabels, mermaidFlow, renderAgentBrief, renderSpecMarkdown, traceOf } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecFeature, SpecInput } from '@/lib/opportunities/spec';
import type { BuildProgress } from '@/lib/opportunities/build-progress';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';
import { inBatches } from '@/lib/utils';
import { useLang } from '@/components/LangProvider';
import ModelPicker, { usePrdModel } from '@/components/ModelPicker';
import type { PrdModel } from '@/lib/opportunities/models';
import { translator } from '@/lib/i18n';
import { downloadText } from './download';
import styles from './stage.module.css';

type View = 'trace' | 'tree' | 'flow' | 'wire' | 'doc';

const VIEWS: Array<[View, string, string]> = [['doc', '문서', 'Document'], ['trace', '기능 명세', 'Feature spec'], ['flow', '유저플로우', 'User flow'], ['wire', '와이어프레임', 'Wireframe'], ['tree', '구조 트리', 'IA tree']];

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

/** Counts items whose title or text changed, so a revision reports what it actually touched. */
function changedCount(before: Spec, after: Spec) {
  const key = (spec: Spec) => new Set([...spec.requirements, ...spec.hypotheses].map((row) => `${row.title}|${row.detail}`).concat(spec.features.map((row) => `${row.title}|${row.detail}`), spec.screens.map((row) => `${row.name}|${row.does}`)));
  const a = key(before);
  const b = key(after);
  return [...b].filter((item) => !a.has(item)).length + [...a].filter((item) => !b.has(item)).length;
}

export default function PrdBuilder({ title, evidenceIds, ready, loginNext, children, endpoint = '/api/opportunities/prd', requestBody, generateLabel, initial, signedIn, generateSignal = 0, onSpec, hideControls = false, externalInstruction, onError, progress, models = [], hideRevise = false }: {
  title: string;
  evidenceIds: string[];
  /** The evidence passes the bar; otherwise the PRD is made as a labeled hypothesis draft. */
  ready: boolean;
  loginNext: string;
  children?: React.ReactNode;
  /** Another generator (the repo reverse spec) can reuse this workspace; it answers with the quotes it picked. */
  endpoint?: string;
  requestBody?: Record<string, unknown>;
  generateLabel?: string;
  /** The last PRD made from the same quotes, shown right away so visitors see a result without signing in. */
  initial?: { input: SpecInput; spec: Spec; createdAt: string } | null;
  /** false: say up front that making a PRD needs an account, instead of after a failed click. */
  signedIn?: boolean;
  /** Bumped by a parent (the idea chat) to start generating without the user pressing this panel's button. */
  generateSignal?: number;
  /** Told when a PRD arrives, so a parent can react (the idea chat posts a reply). */
  onSpec?: (spec: Spec) => void;
  /** The parent owns the start button (the idea chat), so this panel does not show its own. */
  hideControls?: boolean;
  /** A change request typed somewhere else (the idea chat); each new id is sent once. */
  externalInstruction?: { id: number; text: string } | null;
  /** Told when a call fails, so the chat can say so instead of waiting forever. */
  onError?: (message: string) => void;
  /** Features a coding agent marked done through MCP (mark_feature_done), by feature id. */
  progress?: BuildProgress;
  /** The server's model menu; the pick is shared with every PRD screen through browser storage. */
  models?: PrdModel[];
  /** The idea chat takes change requests itself, so the side form would only repeat it. */
  hideRevise?: boolean;
}) {
  const lang = useLang();
  const t = translator(lang);
  const model = usePrdModel(models);
  const [input, setInput] = useState<SpecInput | null>(initial?.input ?? null);
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);
  const ids = pickedIds ?? evidenceIds;
  const customSource = Boolean(requestBody);
  const [spec, setSpec] = useState<Spec | null>(initial?.spec ?? null);
  const [previous, setPrevious] = useState<Spec | null>(null);
  const [view, setView] = useState<View>('doc');
  const [focus, setFocus] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'revising'>('idle');
  // Seconds since the current PRD request started, so the wait shows where the work usually is.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1_000);
    return () => clearInterval(timer);
  }, [status]);
  const [slotPending, setSlotPending] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  // The maker's own direction, written before the PRD is made so it shapes the first draft, not a later edit.
  const [notes, setNotes] = useState('');
  const [format, setFormat] = useState<ExportFormat>('agents');
  const [message, setMessage] = useState(initial ? t(`같은 원문으로 ${new Date(initial.createdAt).toLocaleDateString('ko-KR')}에 만든 PRD입니다.`, `Made from the same quotes on ${new Date(initial.createdAt).toLocaleDateString('en-US')}.`) : '');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const markdown = useMemo(() => (input && spec ? renderSpecMarkdown(input, spec) : ''), [input, spec]);
  const brief = useMemo(() => (input && spec ? renderAgentBrief(input, spec, format) : ''), [input, spec, format]);
  const trace = useMemo(() => (spec && focus ? traceOf(spec, focus) : null), [spec, focus]);

  const fail = (status: number, json: { error?: string }, fallback: string) => {
    if (status === 401) setNeedsLogin(true);
    else setError(json.error ?? fallback);
  };

  const generate = async () => {
    setElapsed(0);
    setStatus('loading');
    setError('');
    setMessage('');
    setNeedsLogin(false);
    try {
      const { status: code, ok, json } = await postJson(endpoint, { ...(requestBody ?? { title, evidenceIds }), lang, model, notes });
      if (!ok) fail(code, json, t('PRD를 만들지 못했습니다.', 'Could not create the PRD.'));
      else {
        setInput(json.input as SpecInput);
        setPickedIds(Array.isArray(json.evidenceIds) ? json.evidenceIds : null);
        if (json.cached) setMessage(t(`AI 모델이 지금 응답하지 않아, 같은 근거로 ${new Date(json.cachedAt).toLocaleString('ko-KR')}에 만든 PRD를 보여줍니다.`, `The AI model is not answering right now, so this is the PRD made from the same quotes on ${new Date(json.cachedAt).toLocaleString('en-US')}.`));
        setSpec(json.spec as Spec);
        onSpec?.(json.spec as Spec);
        setPrevious(null);
        setFocus(null);
        setSaveState('idle');
      }
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setStatus('idle');
    }
  };

  // Only a change of the signal starts a run, never the first render, and never twice for one press.
  const startedSignal = useRef(generateSignal);
  useEffect(() => {
    if (generateSignal === startedSignal.current) return;
    startedSignal.current = generateSignal;
    void generate();
    // generate reads the latest props at call time; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateSignal]);

  useEffect(() => {
    if (error) onError?.(error);
    else if (needsLogin) onError?.('login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, needsLogin]);

  // Idea PRDs carry the user's brief, so follow-up calls rebuild the same context on the server.
  // Follow-up calls rebuild the same context on the server: the idea brief and the maker's notes go along.
  const ideaBrief = { ...(requestBody?.brief ? { brief: requestBody.brief } : {}), notes };

  const fillSlots = async (feature: SpecFeature) => {
    if (!spec) return;
    setSlotPending((before) => [...before, feature.id]);
    try {
      const requirements = feature.requirementIds.flatMap((rid) => [...spec.requirements, ...spec.hypotheses].find((row) => row.id === rid) ?? []);
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/slots', { title, evidenceIds: ids, feature, requirements, lang: spec.lang ?? lang, model, ...ideaBrief });
      if (!ok) fail(code, json, t('슬롯을 채우지 못했습니다.', 'Could not fill the slots.'));
      else setSpec((current) => current && { ...current, features: current.features.map((row) => (row.id === feature.id ? { ...row, slots: json.slots } : row)) });
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setSlotPending((before) => before.filter((id) => id !== feature.id));
    }
  };

  // Two at a time keeps the free model under its rate limit; a failed feature just stays empty.
  const fillAll = () => spec && inBatches(spec.features.filter((row) => !row.slots && !slotPending.includes(row.id)), 2, fillSlots);

  const revise = async (text = instruction) => {
    if (!spec || text.trim().length < 2) return;
    setStatus('revising');
    setError('');
    setMessage('');
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/revise', { title, evidenceIds: ids, spec, instruction: text, model, ...ideaBrief });
      if (!ok) fail(code, json, t('수정하지 못했습니다.', 'Could not revise.'));
      else {
        const next = json.spec as Spec;
        setPrevious(spec);
        setSpec(next);
        onSpec?.(next);
        setFocus(null);
        setInstruction('');
        setSaveState('idle');
        setMessage(t(`"${text.trim()}" 반영: 항목 ${changedCount(spec, next)}곳이 바뀌었습니다. 원문 목록은 그대로입니다.`, `Applied "${text.trim()}": ${changedCount(spec, next)} items changed. The quotes stay the same.`));
      }
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setStatus('idle');
    }
  };

  const sentInstruction = useRef(externalInstruction?.id ?? 0);
  useEffect(() => {
    if (!externalInstruction || externalInstruction.id === sentInstruction.current) return;
    sentInstruction.current = externalInstruction.id;
    void revise(externalInstruction.text);
    // Same as above: one run per new request id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalInstruction]);

  const undo = () => {
    if (!previous) return;
    setSpec(previous);
    setPrevious(null);
    setMessage(t('직전 수정을 되돌렸습니다.', 'Reverted the last change.'));
  };

  const save = async () => {
    setSaveState('saving');
    setError('');
    setNeedsLogin(false);
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/dossiers', { title, evidenceIds: ids, prdMarkdown: markdown || undefined });
      if (!ok) {
        fail(code, json, t('저장하지 못했습니다.', 'Could not save.'));
        setSaveState('idle');
        return;
      }
      setSaveState('saved');
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
      setSaveState('idle');
    }
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(t(`${label}를 복사했습니다.`, `Copied ${label}.`));
    } catch {
      setError(t('클립보드에 복사하지 못했습니다. 파일로 받아주세요.', 'Could not copy. Download the file instead.'));
    }
  };

  // A feature stands on evidence when at least one of its requirements cites a quote; otherwise it is a hypothesis.
  const backed = (feature: SpecFeature) => Boolean(spec?.requirements.some((row) => feature.requirementIds.includes(row.id)));
  const tone = (itemId: string) => (!trace ? '' : trace.ids.has(itemId) ? styles.specOn : styles.specDim);
  const evidenceTone = (n: number) => (!trace ? '' : trace.evidence.has(n) ? styles.specOn : styles.specDim);
  const pick = (itemId: string) => setFocus((current) => (current === itemId ? null : itemId));
  const item = (itemId: string, body: React.ReactNode, className = '') => (
    <button key={itemId} type="button" data-node={itemId} className={`${styles.specItem} ${tone(itemId)} ${className}`} aria-pressed={focus === itemId} onClick={() => pick(itemId)}>
      <span className={styles.specId}>{itemId}</span>
      {body}
    </button>
  );
  const cites = (numbers: number[]) => numbers.length > 0 && <sup className="ml-0.5 font-medium text-seed">{numbers.join(', ')}</sup>;
  // A row of the document that lights up its footnotes when picked, the same way a node does in the trace view.
  const docRow = (id: string, body: React.ReactNode, quiet = false) => (
    <li key={id}>
      <button type="button" aria-pressed={focus === id} onClick={() => pick(id)} className={`-mx-3 grid w-[calc(100%+1.5rem)] grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 rounded-lg px-3 py-3.5 text-left text-[15px] leading-7 transition-colors hover:bg-surface-low aria-pressed:bg-seed-soft ${quiet ? 'text-muted' : 'text-ink'}`}>
        <span className="text-[13px] font-semibold text-muted">{id}</span>
        <span className="min-w-0">{body}</span>
      </button>
    </li>
  );

  const busy = status !== 'idle';
  const h2 = 'scroll-mt-24 text-xl font-bold tracking-tight';
  const quietButton = 'btn-quiet w-full justify-start border-0 font-normal';
  const ready6 = spec ? spec.features.filter((row) => row.slots).length : 0;

  // What the right-hand panel shows for the picked node: what it is, and what it connects to.
  const detail = (() => {
    if (!spec || !input || !focus) return null;
    const evidenceIndex = input.evidence.findIndex((_, index) => focus === `E-${index + 1}`);
    const quote = input.evidence[evidenceIndex];
    const requirement = [...spec.requirements, ...spec.hypotheses].find((row) => row.id === focus);
    const feature = spec.features.find((row) => row.id === focus);
    const screen = spec.screens.find((row) => row.id === focus);
    const hypothesis = spec.hypotheses.some((row) => row.id === focus);
    const names = (ids: string[], rows: Array<{ id: string; title?: string; name?: string }>) => ids.map((id) => `${id} ${rows.find((row) => row.id === id)?.title ?? rows.find((row) => row.id === id)?.name ?? ''}`.trim()).join(', ');
    const rows: Array<[string, React.ReactNode]> = [];
    let kind = '';
    let title = '';
    let body = '';
    if (quote) {
      kind = t('개발자 원문', 'Developer quote');
      title = PLATFORM_LABELS[quote.platform];
      body = quote.quote;
      rows.push([t('출처', 'Source'), <a key="source" href={quote.url} target="_blank" rel="noopener noreferrer" className="font-medium text-seed underline-offset-4 hover:underline">{t('원문', 'Source')} ›</a>]);
    } else if (requirement) {
      kind = hypothesis ? t('가설', 'Hypothesis') : t('요구사항', 'Requirement');
      title = requirement.title;
      body = requirement.detail;
      rows.push([t('근거', 'Evidence'), hypothesis ? t('원문 없음', 'No quote') : <span key="evidence" className="font-medium text-seed">{requirement.evidence.map((n) => `E-${n}`).join(' · ')} ({t('원문과 일치', 'verbatim')})</span>]);
      rows.push([t('기능', 'Features'), names(spec.features.filter((row) => row.requirementIds.includes(requirement.id)).map((row) => row.id), spec.features) || '-']);
    } else if (feature) {
      kind = t('기능', 'Feature');
      title = feature.title;
      body = feature.detail;
      const evidence = [...new Set(spec.requirements.filter((row) => feature.requirementIds.includes(row.id)).flatMap((row) => row.evidence))].sort((a, b) => a - b);
      rows.push([t('요구사항', 'Requirements'), names(feature.requirementIds, [...spec.requirements, ...spec.hypotheses]) || '-']);
      rows.push([t('근거', 'Evidence'), evidence.length ? <span key="evidence" className="font-medium text-seed">{evidence.map((n) => `E-${n}`).join(' · ')} ({t('원문과 일치', 'verbatim')})</span> : t('원문 없음', 'No quote')]);
      rows.push([t('화면', 'Screens'), names(spec.screens.filter((row) => row.featureIds.includes(feature.id)).map((row) => row.id), spec.screens) || '-']);
    } else if (screen) {
      kind = t('화면', 'Screen');
      title = screen.name;
      body = screen.does;
      rows.push([t('기능', 'Features'), names(screen.featureIds, spec.features) || '-']);
    } else return null;

    return (
      <section aria-live="polite" aria-label={t('고른 항목', 'Selected item')}>
        <p className="text-[13px] text-muted">{focus} · {kind}</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{title}</h3>
        {body && <p className="mt-3 text-sm leading-7 text-tertiary">{body}</p>}
        <dl className="mt-4 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
        {feature && (
          <>
            <h4 className="mt-7 text-[15px] font-semibold">{t('개발 준비', 'Build readiness')}</h4>
            {feature.slots ? (
              <dl className="rows mt-3 text-sm">
                {SLOT_KEYS.map((key) => (
                  <div key={key} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt>{slotLabels(lang)[key]}</dt>
                      <dd className={feature.slots![key].length ? 'font-medium text-seed' : 'text-muted'}>{feature.slots![key].length ? t('채움', 'Filled') : t('비어 있음', 'Empty')}</dd>
                    </div>
                    <dd className="mt-1 text-[13px] leading-6 text-muted [overflow-wrap:anywhere]">{feature.slots![key].length ? feature.slots![key].join(' · ') : t('정해지지 않음: 먼저 물어볼 것', 'Open question: ask first')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <button type="button" className="btn-quiet mt-3 w-full" disabled={slotPending.includes(feature.id)} onClick={() => void fillSlots(feature)}>
                {slotPending.includes(feature.id) ? t('빈 칸 채우는 중', 'Filling') : t('빈 칸 채우기', 'Fill the blanks')}
              </button>
            )}
          </>
        )}
      </section>
    );
  })();

  const sections: Array<[string, string, boolean]> = spec && input ? [
    ['overview', t('개요', 'Overview'), true],
    ['problem', t('문제', 'Problem'), true],
    ['requirements', t('요구사항', 'Requirements'), true],
    ['features', t('기능', 'Features'), spec.features.length > 0],
    ['screens', t('화면', 'Screens'), spec.screens.length > 0],
    ['non-goals', t('범위 밖', 'Out of scope'), true],
    ['hypotheses', t('가설', 'Hypotheses'), spec.hypotheses.length > 0],
    ['risks', t('위험 요소', 'Risks'), spec.risks.length > 0],
    ['done', t('완료 기준', 'Done when'), true],
  ] : [];
  const bullets = (rows: string[]) => rows.length
    ? <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-[15px] leading-7 marker:text-outline-strong">{rows.map((row) => <li key={row}>{row}</li>)}</ul>
    : <p className="mt-3 text-[15px] leading-7 text-muted">{t('정의되지 않음', 'Not defined')}</p>;

  return (
    <>
      {!hideControls && signedIn !== false && (
        <div className="mb-4 max-w-[52em]">
          <label htmlFor="prd-notes" className="text-[15px] font-semibold">{t('내 의견', 'Your direction')} <span className="font-normal text-muted">{t('(선택)', '(optional)')}</span></label>
          <p className="mt-1 text-[13px] leading-6 text-muted">{t('누구를 위해, 꼭 넣을 기능, 뺄 것, 원하는 방향을 적으면 처음부터 반영해 만듭니다. 원문이 받쳐 주지 않는 내용은 가설로 표시됩니다.', 'Who it is for, must-haves, what to leave out, the direction you want. It shapes the first draft; anything no quote backs is marked as a hypothesis.')}</p>
          <textarea id="prd-notes" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} placeholder={t('예: 1인 개발자용 CLI로 만들고, 첫 버전은 OpenAI와 Anthropic만 지원. 결제와 팀 기능은 빼기.', 'e.g. A CLI for solo developers; v1 supports only OpenAI and Anthropic. No payments or team features.')} className="mt-2 block w-full border bg-white px-3 py-2.5 text-[15px] leading-6" />
          {spec && notes.trim() && <p className="mt-1.5 text-[13px] text-muted">{t('의견을 바꿨다면 "PRD 다시 만들기"로 새로 반영합니다.', 'Changed your direction? "Make the PRD again" applies it.')}</p>}
        </div>
      )}
      {!hideControls && <div className="flex flex-wrap items-center gap-2">
        {signedIn === false ? (
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className={spec ? 'btn-quiet' : 'btn h-11 px-5'}>
            {spec ? t('로그인하고 다시 만들기', 'Sign in to make it again') : t('로그인하고 PRD 만들기', 'Sign in to make a PRD')}
          </Link>
        ) : (
          <button type="button" className={spec ? 'btn-quiet' : 'btn h-11 px-5'} disabled={(!customSource && !evidenceIds.length) || busy} onClick={generate}>
            {status === 'loading' ? t('PRD 작성 중, 최대 1분 30초', 'Writing the PRD, up to 90 s') : spec ? t('PRD 다시 만들기', 'Make the PRD again') : generateLabel ?? (ready ? t('이 근거로 PRD 만들기', 'Make a PRD from this evidence') : t('가설 초안 PRD 만들기', 'Make a hypothesis-draft PRD'))}
          </button>
        )}
        {signedIn !== false && <ModelPicker models={models} />}
        <button type="button" className={`btn-quiet ${spec ? '' : 'h-11'}`} disabled={!ids.length || saveState === 'saving'} onClick={save}>
          {saveState === 'saved' ? t('보관함에 저장됨', 'Saved') : saveState === 'saving' ? t('저장 중', 'Saving') : t('보관함에 저장', 'Save')}
        </button>
      </div>}
      {!ready && !customSource && !spec && evidenceIds.length > 0 && <p className="mt-3 text-sm text-muted">{t('원문이 기준(원문 3건, 플랫폼 2곳)에 못 미쳐, 모든 내용을 검증 전 가설로 표시한 초안으로 만듭니다.', 'The evidence is below the bar (3 quotes, 2 platforms), so this becomes a draft labeled as unverified.')}</p>}
      {status === 'loading' && <PrdProgress elapsed={elapsed} lang={lang} />}
      {children}
      <div aria-live="polite" className="text-sm text-muted [&>p]:mt-3">
        {needsLogin && <p><Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="font-medium text-seed underline underline-offset-4">{t('로그인', 'Sign in')}</Link>{t('하면 담은 근거를 유지한 채 이어갑니다.', ' to continue with the evidence you collected.')}</p>}
        {error && <p className="text-red-700">{error}</p>}
        {message && <p>{message}</p>}
      </div>

      {input && spec && (
        <section className="mt-8" aria-label={t('생성된 PRD', 'Generated PRD')}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-2xl font-bold tracking-tight">{input.title} PRD</h3>
              <p className="text-sm text-muted">
                {spec.draft && <b className={styles.draftBadge}>{t('가설 초안', 'Hypothesis draft')}</b>}
                <span className="font-medium text-seed">{t('근거 있는 요구사항', 'Backed requirements')} {spec.requirements.length}</span>
                {' · '}{t('가설', 'Hypotheses')} {spec.hypotheses.length}
                {' · '}{t('개발 준비', 'Ready')} {ready6}/{spec.features.length}
                {progress && <>{' · '}<span className="font-medium text-seed">{t('구현 완료', 'Built')} {spec.features.filter((row) => progress[row.id]).length}/{spec.features.length}</span></>}
                {' · '}{t('원문', 'Quotes')} {input.evidence.length} → {t('기능', 'Features')} {spec.features.length} → {t('화면', 'Screens')} {spec.screens.length}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <details className="relative">
                <summary className="btn-quiet cursor-pointer list-none [&::-webkit-details-marker]:hidden">{t('내보내기', 'Export')}</summary>
                <div className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-0.5 rounded-xl border border-outline-soft bg-white p-1.5 shadow-lg">
                  {/* The agent file format lives here, next to the downloads it changes, instead of as its own control. */}
                  <label className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] text-muted">
                    {t('에이전트 파일', 'Agent file')}
                    <select className="h-8 border bg-white px-2 text-sm text-ink" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
                      {(Object.keys(EXPORT_FILES) as ExportFormat[]).map((key) => <option key={key} value={key}>{EXPORT_FILES[key]}</option>)}
                    </select>
                  </label>
                  <button type="button" className={quietButton} onClick={() => downloadText(EXPORT_FILES[format], brief)}>{t(`${EXPORT_FILES[format]} 받기`, `Download ${EXPORT_FILES[format]}`)}</button>
                  <button type="button" className={quietButton} onClick={() => void copy('PRD', markdown)}>{t('PRD 복사', 'Copy PRD')}</button>
                  <button type="button" className={quietButton} onClick={() => downloadText('PRD.md', markdown)}>{t('PRD.md 받기', 'Download PRD.md')}</button>
                  {spec.screens.length > 0 && <button type="button" className={quietButton} onClick={() => void copy('Mermaid', mermaidFlow(spec))}>{t('Mermaid 코드 복사', 'Copy Mermaid code')}</button>}
                </div>
              </details>
              {/* "Send to the agent" is a copy: the brief goes on the clipboard, ready to paste into the coding tool. */}
              <button type="button" className="btn" onClick={() => void copy(EXPORT_FILES[format], brief)}>{t('에이전트로 보내기', 'Send to agent')}</button>
            </div>
          </div>

          <div className="tabs mt-5" role="tablist" aria-label={t('PRD 보기 방식', 'PRD view')}>
            {VIEWS.map(([key, label, labelEn]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} className="tab" onClick={() => setView(key)}>{t(label, labelEn)}</button>
            ))}
          </div>

          <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              {spec.existing && spec.existing.length > 0 && (
                <details className={`${styles.existing} mb-6`} open>
                  <summary>{t(`기존 구조 ${spec.existing.length}개 · 새 기능이 깨면 안 되는 것`, `Existing structure (${spec.existing.length}) · new work must not break it`)}</summary>
                  <ul>{spec.existing.map((row) => <li key={row.name}><b>{row.name}</b>{row.does ? `: ${row.does}` : ''}</li>)}</ul>
                </details>
              )}

              {view === 'doc' && (
                <div className="grid gap-x-10 xl:grid-cols-[140px_minmax(0,1fr)]">
                  <nav className="hidden self-start text-sm xl:sticky xl:top-24 xl:block" aria-label={t('목차', 'Contents')}>
                    <p className="font-semibold">{t('목차', 'Contents')}</p>
                    <ul className="mt-2 grid">
                      {sections.filter(([, , shown]) => shown).map(([id, label]) => <li key={id}><a href={`#prd-${id}`} className="inline-flex min-h-9 items-center text-muted hover:text-ink">{label}</a></li>)}
                    </ul>
                  </nav>
                  <article className="min-w-0 space-y-12">
                    <section>
                      <h4 id="prd-overview" className={h2}>{t('개요', 'Overview')}</h4>
                      <p className="label mt-4">{t('한 줄 정의', 'One line')}</p>
                      <p className="mt-1 text-[15px] leading-7">{spec.summary}</p>
                      <p className="label mt-5">{t('대상 사용자', 'Target users')}</p>
                      <p className="mt-1 text-[15px] leading-7">{spec.targetUsers.join(' · ') || t('정의되지 않음', 'Not defined')}</p>
                    </section>
                    <section>
                      <h4 id="prd-problem" className={h2}>{t('문제', 'Problem')}</h4>
                      <p className="mt-3 text-[15px] leading-7">{input.problem}</p>
                      {input.gap && <p className="mt-3 text-[15px] leading-7 text-tertiary">{input.gap}</p>}
                    </section>
                    <section>
                      <h4 id="prd-requirements" className={h2}>{t('요구사항', 'Requirements')}</h4>
                      {spec.requirements.length
                        ? <ul className="rows mt-3">{spec.requirements.map((row) => docRow(row.id, <>{row.title}{cites(row.evidence)}{row.detail && <span className="block text-sm leading-6 text-muted">{row.detail}</span>}</>))}</ul>
                        : <p className="mt-3 text-[15px] leading-7 text-muted">{t('근거로 뒷받침되는 요구사항이 없습니다.', 'No requirement is backed by evidence yet.')}</p>}
                    </section>
                    {spec.features.length > 0 && (
                      <section>
                        <h4 id="prd-features" className={h2}>{t('기능', 'Features')}</h4>
                        <ul className="rows mt-3">{spec.features.map((row) => docRow(row.id, <>{row.title}{!backed(row) && <span className="ml-2 text-[13px] font-normal text-muted">{t('가설', 'Hypothesis')}</span>}{progress?.[row.id] && <span className="ml-2 text-[13px] font-semibold text-seed" title={progress[row.id].note || undefined}>✓ {t('구현 완료', 'Built')}</span>}<span className="block text-sm leading-6 text-muted">{row.detail} ({t(`${row.requirementIds.join(', ')} 충족`, `serves ${row.requirementIds.join(', ')}`)})</span></>, !backed(row)))}</ul>
                      </section>
                    )}
                    {spec.screens.length > 0 && (
                      <section>
                        <h4 id="prd-screens" className={h2}>{t('화면', 'Screens')}</h4>
                        <p className="mt-1 text-[13px] text-muted">{t('원문에서 나온 것이 아니라 모델이 제안한 순서입니다. 첫 사용자와 확인한 뒤 고치세요.', 'A model-proposed order, not from the evidence. Confirm with first users.')}</p>
                        <ul className="rows mt-3">{spec.screens.map((row) => docRow(row.id, <>{row.name}<span className="block text-sm leading-6 text-muted">{row.does ? `${row.does} ` : ''}({row.featureIds.join(', ')})</span></>))}</ul>
                      </section>
                    )}
                    <section>
                      <h4 id="prd-non-goals" className={h2}>{t('범위 밖', 'Out of scope')}</h4>
                      {bullets(spec.nonGoals)}
                    </section>
                    {spec.hypotheses.length > 0 && (
                      <section>
                        <h4 id="prd-hypotheses" className={h2}>{t('가설', 'Hypotheses')}</h4>
                        <p className="mt-1 text-[13px] text-muted">{t('원문이 받쳐 주지 않는 줄입니다. 만들기 전에 사용자에게 확인합니다.', 'No quote backs these lines. Confirm with users before building.')}</p>
                        <ul className="rows mt-3">{spec.hypotheses.map((row) => docRow(row.id, <>{row.title}{row.detail && <span className="block text-sm leading-6">{row.detail}</span>}</>, true))}</ul>
                      </section>
                    )}
                    {spec.risks.length > 0 && (
                      <section>
                        <h4 id="prd-risks" className={h2}>{t('위험 요소', 'Risks')}</h4>
                        {bullets(spec.risks)}
                      </section>
                    )}
                    <section>
                      <h4 id="prd-done" className={h2}>{t('완료 기준', 'Done when')}</h4>
                      {bullets(spec.metrics)}
                    </section>
                    {spec.rivals?.length ? (
                      <section>
                        <h4 className={h2}>{t('이미 있는 도구가 못 하는 것', 'What existing tools miss')}</h4>
                        <p className="mt-1 text-[13px] text-muted">{t('경쟁 도구 목록과 원문으로만 썼습니다. 도구 설명을 직접 확인한 뒤 쓰세요.', 'Written only from the competitor list and the quotes. Check each tool before relying on it.')}</p>
                        <ul className="rows mt-3">
                          {spec.rivals.map((row) => (
                            <li key={row.name} className="grid gap-1 py-3.5 text-[15px] leading-7 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                              <b className="font-semibold">{row.name}</b>
                              <span className="min-w-0">{row.misses}{row.answer && <span className="block text-sm leading-6 text-seed">→ {row.answer}</span>}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : input.competitors.length > 0 && (
                      <section>
                        <h4 className={h2}>{t('이미 있는 도구', 'Existing tools')}</h4>
                        {bullets(input.competitors)}
                      </section>
                    )}
                    <ol className="grid gap-3 border-t border-outline-strong pt-6 text-sm leading-6">
                      {input.evidence.map((row, index) => (
                        <li key={row.id} className={`grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 transition-opacity ${trace && !trace.evidence.has(index + 1) ? 'opacity-40' : ''}`}>
                          <span className="font-semibold text-seed">{index + 1}</span>
                          <span className="min-w-0 [overflow-wrap:anywhere]">
                            <q lang="en">{row.quote}</q>{' '}
                            <span className="text-muted">{PLATFORM_LABELS[row.platform]}{row.postedAt ? `, ${new Date(row.postedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', { dateStyle: 'medium' })}` : ''}</span>{' '}
                            <a href={row.url} target="_blank" rel="noopener noreferrer" className="font-medium text-seed underline-offset-4 hover:underline">{t('원문', 'Source')} ›</a>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </article>
                </div>
              )}

              {view === 'trace' && (
                <>
                  <div className={styles.specCols}>
                    <GraphEdges spec={spec} evidenceCount={input.evidence.length} trace={trace} />
                    <div className={styles.specCol}>
                      <h4>{t('개발자 원문', 'Developer quotes')}</h4>
                      {input.evidence.map((row, index) => (
                        <button key={row.id} type="button" data-node={`E-${index + 1}`} className={`${styles.specItem} ${styles.specQuote} ${evidenceTone(index + 1)}`} aria-pressed={focus === `E-${index + 1}`} onClick={() => pick(`E-${index + 1}`)}>
                          <span className={styles.specId}>E-{index + 1} · {PLATFORM_LABELS[row.platform]}</span>
                          <q lang="en">{row.quote.length > 140 ? `${row.quote.slice(0, 140)}…` : row.quote}</q>
                        </button>
                      ))}
                    </div>
                    <div className={styles.specCol}>
                      <h4>{t('요구사항', 'Requirements')}</h4>
                      {spec.requirements.map((row) => item(row.id, <><span>{row.title}</span><small>{t('원문', 'Quotes')} {row.evidence.map((n) => `E-${n}`).join(', ')}</small></>))}
                      {spec.hypotheses.map((row) => item(row.id, <><span>{row.title}</span><small>{t('가설 · 원문 없음', 'Hypothesis · no quote')}</small></>, styles.specHypo))}
                    </div>
                    <div className={styles.specCol}>
                      <h4>
                        {t('기능', 'Features')}
                        {spec.features.some((row) => !row.slots) && <button type="button" className="font-medium text-seed underline-offset-4 hover:underline" onClick={() => void fillAll()}>{t('빈 칸 모두 채우기', 'Fill all blanks')}</button>}
                      </h4>
                      {spec.features.map((row) => item(row.id, <><span>{row.title}</span><small>{t(`${row.requirementIds.join(', ')} 충족`, `Serves ${row.requirementIds.join(', ')}`)} · {row.slots ? t('개발 준비 채움', 'readiness filled') : slotPending.includes(row.id) ? t('채우는 중', 'filling') : t('개발 준비 비어 있음', 'readiness empty')}</small></>, backed(row) ? '' : styles.specHypo))}
                    </div>
                    <div className={styles.specCol}>
                      <h4>{t('화면', 'Screens')}</h4>
                      {spec.screens.map((row) => item(row.id, <><span>{row.name}</span><small>{row.featureIds.join(', ')}</small></>))}
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">{t('초록 선은 개발자 원문에서 나온 연결, 점선 상자는 원문 없는 가설입니다. 항목을 누르면 이어진 원문·요구사항·기능·화면이 함께 강조되고 오른쪽에 명세가 열립니다.', 'Green lines start from developer quotes; dashed boxes are hypotheses with no quote. Click an item to light up its chain and open its spec on the right.')}</p>
                </>
              )}

              {view === 'tree' && (
                <ul className={styles.specTree}>
                  {[...spec.requirements, ...spec.hypotheses].map((requirement) => (
                    <li key={requirement.id}>
                      <span className={styles.specId}>{requirement.id}</span> <b className="font-semibold">{requirement.title}</b> <small>({requirement.evidence.length ? requirement.evidence.map((n) => `E-${n}`).join(', ') : t('가설 · 원문 없음', 'hypothesis · no quote')})</small>
                      <ul>
                        {spec.features.filter((feature) => feature.requirementIds.includes(requirement.id)).map((feature) => (
                          <li key={feature.id}>
                            <span className={styles.specId}>{feature.id}</span> {feature.title}
                            <ul>
                              {spec.screens.filter((screen) => screen.featureIds.includes(feature.id)).map((screen) => (
                                <li key={screen.id}><span className={styles.specId}>{screen.id}</span> {screen.name}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}

              {view === 'wire' && <Wireframes spec={spec} focus={focus} pick={pick} lang={lang} />}

              {view === 'flow' && (
                <div>
                  <ol className={styles.flow}>
                    {spec.screens.map((screen) => (
                      <li key={screen.id}>
                        <span className={styles.specId}>{screen.id}</span>
                        <span className="font-medium">{screen.name}</span>
                        {screen.does && <small>{screen.does}</small>}
                      </li>
                    ))}
                  </ol>
                  {spec.screens.length > 0 && <button type="button" className="btn-quiet" onClick={() => void copy('Mermaid', mermaidFlow(spec))}>{t('Mermaid 코드 복사', 'Copy Mermaid code')}</button>}
                </div>
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
              {detail}
              {!hideRevise && <form onSubmit={(event) => { event.preventDefault(); void revise(); }}>
                <label htmlFor="prd-revise" className="text-[15px] font-semibold">{t('수정 요청', 'Request a change')}</label>
                <p className="mt-1 text-[13px] text-muted">{t('고친 내용도 원문 검사를 다시 거칩니다.', 'Changes go through the source check again.')}</p>
                <textarea id="prd-revise" rows={4} value={instruction} maxLength={300} onChange={(event) => setInstruction(event.target.value)} placeholder={t('예: 타겟을 초보 개발자로 좁혀줘', 'e.g. Narrow the target to beginner developers')} disabled={busy} className="mt-3 block w-full border bg-white px-3 py-2.5 text-sm leading-6" />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="submit" className="btn-quiet" disabled={busy || instruction.trim().length < 2}>{status === 'revising' ? t('고치는 중', 'Revising') : t('요청 보내기', 'Send request')}</button>
                  {previous && <button type="button" className="text-sm font-medium text-seed underline-offset-4 hover:underline" onClick={undo} disabled={busy}>{t('되돌리기', 'Undo')}</button>}
                </div>
              </form>}
            </aside>
          </div>
        </section>
      )}
    </>
  );
}

type Trace = ReturnType<typeof traceOf>;

/** Lines between the columns of the feature spec, measured from the rendered boxes so they follow every resize. */
function GraphEdges({ spec, evidenceCount, trace }: { spec: Spec; evidenceCount: number; trace: Trace | null }) {
  // The graph box is this svg's parent: a parent's ref is not attached yet when a child's layout effect runs.
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<Array<{ key: string; d: string; from: string; to: string; quote: boolean; guess: boolean }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const links = useMemo(() => {
    const hypotheses = new Set(spec.hypotheses.map((row) => row.id));
    return [
      ...spec.requirements.flatMap((row) => row.evidence.filter((n) => n <= evidenceCount).map((n) => ({ from: `E-${n}`, to: row.id, quote: true, guess: false }))),
      ...spec.features.flatMap((row) => row.requirementIds.map((rid) => ({ from: rid, to: row.id, quote: false, guess: hypotheses.has(rid) }))),
      ...spec.screens.flatMap((row) => row.featureIds.map((fid) => ({ from: fid, to: row.id, quote: false, guess: false }))),
    ];
  }, [spec, evidenceCount]);

  useLayoutEffect(() => {
    const box = svgRef.current?.parentElement;
    if (!box) return;
    const measure = () => {
      const origin = box.getBoundingClientRect();
      const rect = (id: string) => box.querySelector<HTMLElement>(`[data-node="${id}"]`)?.getBoundingClientRect();
      setPaths(links.flatMap((link) => {
        const a = rect(link.from);
        const b = rect(link.to);
        // On a narrow screen the columns stack; a line drawn backwards would only add noise.
        if (!a || !b || b.left <= a.right) return [];
        const x1 = a.right - origin.left + box.scrollLeft;
        const y1 = a.top + a.height / 2 - origin.top + box.scrollTop;
        const x2 = b.left - origin.left + box.scrollLeft;
        const y2 = b.top + b.height / 2 - origin.top + box.scrollTop;
        const mid = (x1 + x2) / 2;
        return [{ ...link, key: `${link.from}>${link.to}`, d: `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}` }];
      }));
      setSize({ w: box.scrollWidth, h: box.scrollHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [links]);

  const lit = (from: string, to: string) => (from.startsWith('E-') ? trace!.evidence.has(Number(from.slice(2))) : trace!.ids.has(from)) && trace!.ids.has(to);
  return (
    <svg ref={svgRef} aria-hidden="true" className={styles.specEdges} width={size.w} height={size.h}>
      {paths.map((path) => {
        const on = trace ? lit(path.from, path.to) : null;
        return <path key={path.key} d={path.d} fill="none" className={path.quote ? 'stroke-seed' : 'stroke-outline-strong'} strokeWidth={on ? 2.2 : 1.3} strokeDasharray={path.guess ? '4 4' : undefined} opacity={on === false ? 0.12 : 1} />;
      })}
    </svg>
  );
}

/** Lo-fi screens built from the spec: one numbered box per feature, each tracing back to its requirements and quotes. */
function Wireframes({ spec, focus, pick, lang }: { spec: Spec; focus: string | null; pick: (id: string) => void; lang: 'ko' | 'en' }) {
  const t = translator(lang);
  const [current, setCurrent] = useState(spec.screens[0]?.id ?? '');
  const screen = spec.screens.find((row) => row.id === current) ?? spec.screens[0];
  if (!screen) return <p className="text-[15px] leading-7 text-muted">{t('정해진 화면이 없습니다. 수정 요청으로 화면을 추가해 보세요.', 'No screens yet. Ask for screens in a change request.')}</p>;

  const features = screen.featureIds.flatMap((id) => spec.features.find((row) => row.id === id) ?? []);
  const quotesOf = (feature: SpecFeature) => [...new Set(spec.requirements.filter((row) => feature.requirementIds.includes(row.id)).flatMap((row) => row.evidence))].sort((a, b) => a - b);
  return (
    <div>
      <div className="tabs" role="tablist" aria-label={t('화면', 'Screens')}>
        {spec.screens.map((row) => (
          <button key={row.id} type="button" role="tab" aria-selected={row.id === screen.id} className="tab" onClick={() => setCurrent(row.id)}>
            <span className="text-xs font-medium text-muted">{row.id}</span>{row.name}
          </button>
        ))}
      </div>
      {screen.does && <p className="mt-4 text-[15px] leading-7 text-tertiary">{screen.does}</p>}

      <div className={styles.wireFrame}>
        <div className={styles.wireBar} aria-hidden="true"><i /><i /><i /><span>{screen.name}</span></div>
        <div className={styles.wireBody}>
          <div className={styles.wireNav} aria-hidden="true"><i className={styles.wireLogo} /><i style={{ width: '16%' }} /><i style={{ width: '10%' }} /><i style={{ width: '10%' }} /></div>
          <div className={styles.wireGrid}>
            {features.map((feature, index) => (
              <button key={feature.id} type="button" aria-pressed={focus === feature.id} onClick={() => pick(feature.id)} className={`${styles.wireBlock} ${quotesOf(feature).length ? '' : styles.wireGuess}`}>
                <span className={styles.wirePin}>{index + 1}</span>
                <span className={styles.wireTitle}>{feature.title}</span>
                <i style={{ width: '88%' }} /><i style={{ width: '66%' }} />
                {index === 0 && <i className={styles.wireAction} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ol className="rows mt-6">
        {features.map((feature, index) => {
          const quotes = quotesOf(feature);
          return (
            <li key={feature.id}>
              <button type="button" onClick={() => pick(feature.id)} aria-pressed={focus === feature.id} className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 py-3.5 text-left text-[15px] leading-6 aria-pressed:bg-seed-soft">
                <span className={`${styles.wirePinStatic} ${quotes.length ? '' : styles.wirePinGuess}`}>{index + 1}</span>
                <span className="min-w-0">
                  <b className="font-semibold">{feature.title}</b>
                  <span className="block text-[13px] text-muted">
                    {feature.id} · {feature.requirementIds.join(', ')}
                    {' · '}
                    {quotes.length ? <span className="font-medium text-seed">{t('원문', 'Quotes')} {quotes.map((n) => `E-${n}`).join(', ')}</span> : t('가설 · 원문 없음', 'Hypothesis · no quote')}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13px] text-muted">{t('번호를 누르면 그 기능의 명세가 오른쪽에 열립니다. 점선 상자는 원문이 받쳐 주지 않는 가설 기능입니다.', 'Click a number to open that feature on the right. Dashed boxes are features no quote backs.')}</p>
    </div>
  );
}

// Where a PRD request usually is after so many seconds. The server answers in one piece, so these are typical
// timings, said as such, not live reports.
const PROGRESS_STEPS: Array<[number, string, string]> = [
  [0, '원문과 의견을 읽는 중', 'Reading the quotes and your notes'],
  [8, '요구사항을 쓰는 중', 'Writing the requirements'],
  [30, '기능과 화면을 잇는 중', 'Linking features and screens'],
  [55, '빠진 곳을 검사하고 보완하는 중', 'Checking for gaps and repairing'],
];
const EXPECTED_SECONDS = 90;

function PrdProgress({ elapsed, lang }: { elapsed: number; lang: 'ko' | 'en' }) {
  const t = translator(lang);
  const current = PROGRESS_STEPS.filter(([from]) => elapsed >= from).length - 1;
  return (
    <div className="mt-5 max-w-[52em] rounded-2xl border border-outline-soft bg-white p-5" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[15px] font-semibold">{t(PROGRESS_STEPS[current][1], PROGRESS_STEPS[current][2])}</p>
        <p className="num text-sm text-muted">{elapsed}{t('초', 's')}</p>
      </div>
      <span aria-hidden="true" className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-high">
        <span className="block h-full rounded-full bg-seed transition-[width] duration-1000" style={{ width: `${Math.min(95, (elapsed / EXPECTED_SECONDS) * 100)}%` }} />
      </span>
      <ol className="mt-4 grid gap-1.5 text-sm sm:grid-cols-4">
        {PROGRESS_STEPS.map(([from, ko, en], index) => (
          <li key={from} className={index < current ? 'text-seed' : index === current ? 'font-medium text-ink' : 'text-muted'}>{index < current ? '✓ ' : ''}{t(ko, en)}</li>
        ))}
      </ol>
      <p className="mt-3 text-[13px] text-muted">{t('보통 30초~1분 30초 걸립니다. 무료 모델은 더 오래 걸리거나 실패할 수 있습니다.', 'Usually 30 to 90 seconds. Free models can take longer or fail.')}</p>
    </div>
  );
}
