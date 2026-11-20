'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { changedLines } from '@/lib/opportunities/spec-diff';
import { recommendToolkit } from '@/lib/opportunities/toolkit';
import { EVIDENCE_STRENGTH_LABELS, EXPORT_FILES, PRD_SENTENCE_LABELS, evidenceStrengthFor, prdSentenceKinds, SLOT_KEYS, slotIsOpen, slotLabels, slotsNeedReview, readinessWithQuestions, mermaidFlow, renderAgentBrief, renderSpecMarkdown, traceOf } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecFeature, SpecInput, SpecRequirement } from '@/lib/opportunities/spec';
import type { BuildProgress, BuildProgressHistory, FeatureStatus } from '@/lib/opportunities/build-progress';
import type { FeatureCommitSummary } from '@/lib/opportunities/feature-commits';
import { PLATFORM_LABELS } from '@/lib/opportunities/types';
import { onboardingAnswers } from '@/lib/db/onboarding';
import { exportFormatOrder, ONBOARDING_TOOL_STORAGE_KEY, preferredExportFormat } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/client';
import { inBatches } from '@/lib/utils';
import { useLang } from '@/components/LangProvider';
import ModelPicker, { usePrdModel } from '@/components/ModelPicker';
import type { PrdModel } from '@/lib/opportunities/models';
import { translator } from '@/lib/i18n';
import { citedQuotes } from '@/lib/opportunities/prd-markdown';
import WatchIdeaButton from '@/components/WatchIdeaButton';
import { downloadText } from './download';
import { GraphEdges, LivePrd, Wireframes, liveStepsAfter, type LivePhase, type LiveStep } from './PrdParts';
import styles from './stage.module.css';

type Version = { spec: Spec; label: string; at: string };
const MAX_VERSIONS = 20;
// Versions kept in this browser, so a reload or a later visit picks the work up again. Ten keeps it well under the
// storage quota (a spec is a few kilobytes).
const STORED_VERSIONS = 10;
const STORAGE_PREFIX = 'seedup:prd:';

/** Where one PRD's versions live in this browser: per title and quote set. */
const storageKeyFor = (title: string, ids: string[]) => `${STORAGE_PREFIX}${title.slice(0, 120)}|${[...ids].sort().join(',').slice(0, 400)}`;

/** Drops every stored version for a title, for "start over". */
export function forgetStoredPrd(title: string) {
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(`${STORAGE_PREFIX}${title.slice(0, 120)}|`)) window.localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was stored either.
  }
}
type View = 'trace' | 'tree' | 'flow' | 'wire' | 'doc';

const VIEWS: Array<[View, string, string]> = [['doc', '문서', 'Document'], ['trace', '기능 명세', 'Feature spec'], ['flow', '유저플로우', 'User flow'], ['wire', '와이어프레임', 'Wireframe'], ['tree', '구조 트리', 'IA tree']];
const STATUS_LABELS: Record<FeatureStatus, [string, string]> = {
  todo: ['대기', 'To do'],
  in_progress: ['작업 중', 'In progress'],
  improving: ['개선 중', 'Improving'],
  done: ['완료', 'Done'],
  blocked: ['막힘', 'Blocked'],
  needs_recheck: ['다시 확인 필요', 'Needs recheck'],
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

/** Counts items (by id) that were added, removed or changed in any field, so a revision reports what it touched. */
function changedCount(before: Spec, after: Spec) {
  const items = (spec: Spec) => new Map([...spec.requirements, ...spec.hypotheses, ...spec.features, ...spec.screens].map((row) => [row.id, JSON.stringify(row)]));
  const a = items(before);
  const b = items(after);
  return new Set([...a.keys(), ...b.keys()].filter((id) => a.get(id) !== b.get(id))).size;
}

export default function PrdBuilder({ title, evidenceIds, ready, loginNext, children, endpoint = '/api/opportunities/prd', requestBody, generateLabel, initial, signedIn, generateSignal = 0, onSpec, hideControls = false, externalInstruction, onError, progress, progressHistory, featureCommits, models = [], hideRevise = false, showTitle = true, agentSlug, preferredTool: initialPreferredTool = null }: {
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
  progress?: BuildProgress;
  progressHistory?: BuildProgressHistory;
  featureCommits?: FeatureCommitSummary;
  /** The server's model menu; the pick is shared with every PRD screen through browser storage. */
  models?: PrdModel[];
  /** The idea chat takes change requests itself, so the side form would only repeat it. */
  hideRevise?: boolean;
  /** false when the page above already names the PRD in its heading. */
  showTitle?: boolean;
  /** An opportunity's slug: the agent menu then also offers the MCP start prompt, which builds from that opportunity. */
  agentSlug?: string;
  /** Tool format chosen at onboarding, if already resolved on the server. */
  preferredTool?: ExportFormat | null;
}) {
  const lang = useLang();
  const t = translator(lang);
  const progressDate = useMemo(() => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }), [lang]);
  const model = usePrdModel(models);
  const [input, setInput] = useState<SpecInput | null>(initial?.input ?? null);
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);
  const ids = pickedIds ?? evidenceIds;
  const customSource = Boolean(requestBody);
  const [spec, setSpec] = useState<Spec | null>(initial?.spec ?? null);
  // Every version of this PRD in this visit, oldest first; the last one is what is on screen.
  const [versions, setVersions] = useState<Version[]>(initial?.spec ? [{ spec: initial.spec, label: t('불러온 PRD', 'Loaded PRD'), at: initial.createdAt }] : []);
  const [compare, setCompare] = useState<number | null>(null);
  const previous = versions.length > 1 ? versions[versions.length - 2].spec : null;
  const addVersion = (next: Spec, label: string) => setVersions((list) => [...list, { spec: next, label, at: new Date().toISOString() }].slice(-MAX_VERSIONS));
  const [view, setView] = useState<View>('doc');
  const [focus, setFocus] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'revising'>('idle');
  // The PRD as the model writes it, shown until the checked spec arrives. Text is buffered in a ref and drawn once a
  // frame, so a fast model's hundreds of small pieces do not re-render the page hundreds of times.
  const [live, setLive] = useState<{ text: string; phase: LivePhase; restarted: boolean; steps: LiveStep[] } | null>(null);
  const liveText = useRef('');
  // What the server has done so far, for the step list beside the live document.
  const liveSteps = useRef<LiveStep[]>([]);
  const liveStart = useRef(0);
  const liveFrame = useRef(0);
  // Seconds since the current PRD request started, so the wait shows where the work usually is.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1_000);
    return () => clearInterval(timer);
  }, [status]);
  const [slotPending, setSlotPending] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  // A change to the one item open in the side panel.
  const [itemInstruction, setItemInstruction] = useState('');
  // The maker's own direction, written before the PRD is made so it shapes the first draft, not a later edit.
  const [notes, setNotes] = useState('');
  const [pickedTool, setPickedTool] = useState<ExportFormat | null>(initialPreferredTool);
  const { primary: primaryFormat, others: otherFormats } = useMemo(() => exportFormatOrder(pickedTool), [pickedTool]);
  const [format, setFormat] = useState<ExportFormat>(initialPreferredTool ?? 'agents');
  useEffect(() => {
    if (initialPreferredTool) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage after mount */
    try {
      const savedTool = preferredExportFormat(window.localStorage.getItem(ONBOARDING_TOOL_STORAGE_KEY));
      if (savedTool) {
        setPickedTool(savedTool);
        setFormat(savedTool);
      }
    } catch {
      // Storage blocked.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    if (signedIn === false) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const answers = await onboardingAnswers(supabase, data.user.id).catch(() => null);
      const fromDb = preferredExportFormat(answers);
      if (fromDb) {
        setPickedTool(fromDb);
        setFormat(fromDb);
        try { window.localStorage.setItem(ONBOARDING_TOOL_STORAGE_KEY, fromDb); } catch { /* ignore */ }
      }
    }).catch(() => undefined);
  }, [initialPreferredTool, signedIn]);
  const [message, setMessage] = useState(initial ? t(`같은 원문으로 ${new Date(initial.createdAt).toLocaleDateString('ko-KR')}에 만든 PRD입니다.`, `Made from the same quotes on ${new Date(initial.createdAt).toLocaleDateString('en-US')}.`) : '');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Pick up where this browser left off: the stored versions win over the shared cache when they are newer.
  const storageKey = useMemo(() => storageKeyFor(title, evidenceIds), [title, evidenceIds]);
  const restoredKey = useRef('');
  useEffect(() => {
    if (restoredKey.current === storageKey) return;
    restoredKey.current = storageKey;
    let stored: { input: SpecInput; versions: Version[] } | null = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    } catch {
      stored = null;
    }
    const latest = stored?.versions?.[stored.versions.length - 1];
    if (!stored?.input || !latest?.spec || (initial && latest.at <= initial.createdAt)) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage, which only exists after mount */
    setInput(stored.input);
    setSpec(latest.spec);
    setVersions(stored.versions);
    setMessage(t(`이 브라우저에 남아 있던 PRD와 버전 기록 ${stored.versions.length}개를 불러왔습니다.`, `Loaded the PRD and ${stored.versions.length} versions left in this browser.`));
    /* eslint-enable react-hooks/set-state-in-effect */
    onSpec?.(latest.spec);
    // Runs once per PRD identity; the props it reads are fixed for that identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (!input || !versions.length) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ input, versions: versions.slice(-STORED_VERSIONS) }));
    } catch {
      // Full or blocked storage: the versions still last for this visit.
    }
  }, [storageKey, input, versions]);

  const markdown = useMemo(() => (input && spec ? renderSpecMarkdown(input, spec) : ''), [input, spec]);
  const brief = useMemo(() => (input && spec ? renderAgentBrief(input, spec, format, agentSlug) : ''), [input, spec, format, agentSlug]);
  const trace = useMemo(() => (spec && focus ? traceOf(spec, focus) : null), [spec, focus]);

  const fail = (status: number, json: { error?: string }, fallback: string) => {
    if (status === 401) setNeedsLogin(true);
    else setError(json.error ?? fallback);
  };

  // A finished PRD (from the stream's last line or a plain JSON answer) replaces whatever was on screen.
  const accept = (json: Record<string, unknown>) => {
    setInput(json.input as SpecInput);
    setPickedIds(Array.isArray(json.evidenceIds) ? (json.evidenceIds as string[]) : null);
    if (json.cached) setMessage(t(`AI 모델이 지금 응답하지 않아, 같은 근거로 ${new Date(String(json.cachedAt)).toLocaleString('ko-KR')}에 만든 PRD를 보여줍니다.`, `The AI model is not answering right now, so this is the PRD made from the same quotes on ${new Date(String(json.cachedAt)).toLocaleString('en-US')}.`));
    setSpec(json.spec as Spec);
    onSpec?.(json.spec as Spec);
    setVersions([{ spec: json.spec as Spec, label: t('처음 만든 PRD', 'First PRD'), at: new Date().toISOString() }]);
    setView('doc');
    setCompare(null);
    setFocus(null);
    setSaveState('idle');
    autoSave.current = true;
  };

  const showLive = (phase: LivePhase, restarted = false) => {
    cancelAnimationFrame(liveFrame.current);
    liveSteps.current = liveStepsAfter(liveSteps.current, { phase, text: liveText.current, restarted, at: Math.round((Date.now() - liveStart.current) / 1000) });
    liveFrame.current = requestAnimationFrame(() => setLive((before) => ({ text: liveText.current, phase, restarted: restarted || Boolean(before?.restarted), steps: liveSteps.current })));
  };

  const generate = async () => {
    setElapsed(0);
    setStatus('loading');
    setError('');
    setMessage('');
    setNeedsLogin(false);
    liveText.current = '';
    // Only the PRD route streams; another generator (the repo reverse spec) answers in one piece.
    const streaming = endpoint === '/api/opportunities/prd';
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(requestBody ?? { title, evidenceIds }), lang, model, notes, ...(streaming ? { stream: true } : {}) }) });
      if (!response.ok || !response.body || !(response.headers.get('content-type') ?? '').includes('ndjson')) {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) fail(response.status, json, t('PRD를 만들지 못했습니다.', 'Could not create the PRD.'));
        else accept(json);
        return;
      }
      liveStart.current = Date.now();
      liveSteps.current = liveStepsAfter([], { phase: 'waiting', text: '', restarted: false, at: 0 });
      setLive({ text: '', phase: 'waiting', restarted: false, steps: liveSteps.current });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;
      let phase: LivePhase = 'waiting';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          let event: { type?: string; text?: string; stage?: LivePhase; error?: string } & Record<string, unknown>;
          try { event = JSON.parse(line); } catch { continue; }
          if (event.type === 'ping') continue;
          if (event.type === 'delta' && event.text) {
            liveText.current += event.text;
            phase = 'writing';
            showLive(phase);
          } else if (event.type === 'thinking' && !liveText.current) {
            phase = 'thinking';
            showLive(phase);
          } else if (event.type === 'restart') {
            liveText.current = '';
            phase = 'waiting';
            showLive(phase, true);
          } else if (event.type === 'stage' && event.stage) {
            phase = event.stage;
            showLive(phase);
          } else if (event.type === 'done') {
            finished = true;
            accept(event);
          } else if (event.type === 'error') {
            finished = true;
            setError(event.error ?? t('PRD를 만들지 못했습니다.', 'Could not create the PRD.'));
          }
        }
      }
      if (!finished) setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      cancelAnimationFrame(liveFrame.current);
      setLive(null);
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
  // Web quotes and the maker's own notes go along too: the server numbers the evidence afresh on every call, and
  // without them a revision would renumber E-n and drop the citations to them.
  const ideaBrief = { ...(requestBody?.brief ? { brief: requestBody.brief } : {}), ...(requestBody?.liveEvidence ? { liveEvidence: requestBody.liveEvidence } : {}), ...(requestBody?.ownNotes ? { ownNotes: requestBody.ownNotes } : {}), notes };

  const fillSlots = async (feature: SpecFeature) => {
    if (!spec) return;
    setSlotPending((before) => [...before, feature.id]);
    try {
      const requirements = feature.requirementIds.flatMap((rid) => [...spec.requirements, ...spec.hypotheses].find((row) => row.id === rid) ?? []);
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/slots', { title, evidenceIds: ids, feature, requirements, lang: spec.lang ?? lang, model, ...ideaBrief });
      if (!ok) fail(code, json, t('슬롯을 채우지 못했습니다.', 'Could not fill the slots.'));
      else {
        const fill = (current: Spec) => ({ ...current, features: current.features.map((row) => (row.id === feature.id ? { ...row, slots: readinessWithQuestions(row.slots, current.lang ?? lang, json.slots) } : row)) });
        setSpec((current) => current && fill(current));
        // Filled slots belong to the current version, so a reload brings them back too.
        setVersions((list) => list.length ? [...list.slice(0, -1), { ...list[list.length - 1], spec: fill(list[list.length - 1].spec) }] : list);
      }
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setSlotPending((before) => before.filter((id) => id !== feature.id));
    }
  };

  // Two at a time keeps the free model under its rate limit; a failed feature just stays empty.
  const fillAll = () => spec && inBatches(spec.features.filter((row) => slotsNeedReview(row.slots) && !slotPending.includes(row.id)), 2, fillSlots);

  // `label` names the change in the version list when the sent instruction is longer than what the person typed.
  const revise = async (text = instruction, label = text.trim()) => {
    if (!spec || text.trim().length < 2) return;
    setStatus('revising');
    setError('');
    setMessage('');
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/revise', { title, evidenceIds: ids, spec, instruction: text, model, ...ideaBrief });
      if (!ok) fail(code, json, t('수정하지 못했습니다.', 'Could not revise.'));
      else {
        const next = json.spec as Spec;
        addVersion(next, label);
        setSpec(next);
        onSpec?.(next);
        setFocus(null);
        setInstruction('');
        setSaveState('idle');
        setMessage(t(`"${label}" 반영: 항목 ${changedCount(spec, next)}곳이 바뀌었습니다. 원문 목록은 그대로입니다.`, `Applied "${label}": ${changedCount(spec, next)} items changed. The quotes stay the same.`));
      }
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setStatus('idle');
    }
  };

  // The document comes first; screens (user flow, wireframes) are designed only when the reader asks for them.
  const designScreens = async () => {
    if (!spec || status !== 'idle') return;
    setStatus('revising');
    setError('');
    setMessage('');
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/revise', { title, evidenceIds: ids, spec, mode: 'screens', model, ...ideaBrief });
      if (!ok) fail(code, json, t('화면을 설계하지 못했습니다.', 'Could not design the screens.'));
      else {
        const next = json.spec as Spec;
        addVersion(next, t('화면 설계', 'Screens designed'));
        setSpec(next);
        onSpec?.(next);
        setSaveState('idle');
        setMessage(t(`화면 ${next.screens.length}개를 설계했습니다. 유저플로우와 와이어프레임에서 볼 수 있습니다.`, `Designed ${next.screens.length} screens. See them in the user flow and wireframes.`));
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

  // Going back adds the old version again on top, so no version is ever lost.
  const restore = (index: number) => {
    const target = versions[index];
    if (!target) return;
    setSpec(target.spec);
    onSpec?.(target.spec);
    addVersion(target.spec, t(`버전 ${index + 1}로 되돌림`, `Back to version ${index + 1}`));
    setCompare(null);
    setSaveState('idle');
    setMessage(t(`버전 ${index + 1}로 되돌렸습니다.`, `Went back to version ${index + 1}.`));
  };
  const undo = () => restore(versions.length - 2);
  const diff = useMemo(() => {
    if (compare === null || !input || !versions[compare] || compare === 0) return null;
    return changedLines(renderSpecMarkdown(input, versions[compare - 1].spec), renderSpecMarkdown(input, versions[compare].spec));
  }, [compare, input, versions]);

  const save = async () => {
    setSaveState('saving');
    setError('');
    setNeedsLogin(false);
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/dossiers', {
        title,
        evidenceIds: ids,
        ...(requestBody?.liveEvidence ? { liveEvidence: requestBody.liveEvidence } : {}),
        ...(agentSlug ? { opportunitySlug: agentSlug } : {}),
        prdMarkdown: markdown || undefined,
      });
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

  // A newly made PRD goes to the bookmarks on its own, once its markdown has rendered; edits after that still need the button.
  const autoSave = useRef(false);
  useEffect(() => {
    if (!autoSave.current || !markdown) return;
    autoSave.current = false;
    void save();
    // save reads the just-rendered markdown and ids; it must not re-run when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

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
  // Quote numbers as small chips next to a line; pressing a chip or line lights those quotes in the evidence panel.
  const cites = (numbers: number[], interactive = false) => numbers.length > 0 && (
    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-[2px]">
      {numbers.map((n) => (interactive ? (
        <button key={n} type="button" aria-pressed={focus === `E-${n}`} onClick={() => pick(`E-${n}`)} className="rounded bg-seed-soft px-1.5 py-px text-[11px] font-semibold leading-4 text-seed hover:underline">
          E-{n}
        </button>
      ) : (
        <span key={n} className="rounded bg-seed-soft px-1.5 py-px text-[11px] font-semibold leading-4 text-seed">E-{n}</span>
      )))}
    </span>
  );
  // Prose keeps the model's [E1] tags; each becomes a clickable chip that highlights its quote via traceOf.
  const prose = (text: string) => text.split(/(\[\s*E\s*-?\s*\d+(?:\s*[,，]\s*E?\s*-?\s*\d+)*\s*\])/gi).map((part, index) => (index % 2 ? <span key={index}>{cites(citedQuotes(part), true)}</span> : part));
  const strengthText = (row: SpecRequirement) => t(...EVIDENCE_STRENGTH_LABELS[evidenceStrengthFor(row.evidence, input?.evidence ?? [])]);
  const taggedProse = (value: string) => input ? prdSentenceKinds(value, input).map(({ kind, text }, index) => (
    <span key={index}>
      {index > 0 && ' '}
      <span className="mr-1.5 rounded bg-surface-mid px-1.5 py-px text-xs font-medium text-tertiary">{t(...PRD_SENTENCE_LABELS[kind])}</span>{' '}
      {prose(text)}
    </span>
  )) : prose(value);
  const priorityBadge = (priority?: string) => priority && <span className={`mr-2 rounded px-1.5 py-px align-[2px] text-[11.5px] font-semibold ${priority === 'P0' ? 'bg-ink text-white' : 'bg-surface-mid text-tertiary'}`}>{priority}</span>;
  const acceptanceLines = (lines?: string[]) => lines?.length ? lines.map((line) => <span key={line} className="mt-1 block text-[13.5px] leading-6 text-tertiary"><span aria-hidden="true" className="mr-1.5 text-seed">✓</span>{line}</span>) : null;
  // A row of the document that lights up its footnotes when picked, the same way a node does in the trace view.
  const docRow = (id: string, body: React.ReactNode, quiet = false, footer?: React.ReactNode) => (
    <li key={id}>
      <button type="button" aria-pressed={focus === id} onClick={() => pick(id)} className={`-mx-3 grid w-[calc(100%+1.5rem)] grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 rounded-lg px-3 py-3.5 text-left text-[15px] leading-7 transition-colors hover:bg-surface-low aria-pressed:bg-seed-soft ${quiet ? 'text-muted' : 'text-ink'}`}>
        <span className="text-[11px] font-medium text-muted">{id}</span>
        <span className="min-w-0">{body}</span>
      </button>
      {footer}
    </li>
  );

  const busy = status !== 'idle';
  const h2 = 'scroll-mt-24 text-xl font-bold tracking-tight';
  const quietButton = 'btn-quiet w-full justify-start whitespace-nowrap border-0 font-normal';
  const ready6 = spec ? spec.features.filter((row) => !slotsNeedReview(row.slots)).length : 0;

  // What the right-hand panel shows for the picked node: what it is, and what it connects to.
  const detail = (() => {
    if (!spec || !input || !focus) return null;
    const evidenceIndex = input.evidence.findIndex((_, index) => focus === `E-${index + 1}`);
    const quote = input.evidence[evidenceIndex];
    const requirement = [...spec.requirements, ...spec.hypotheses].find((row) => row.id === focus);
    const feature = spec.features.find((row) => row.id === focus);
    const screen = spec.screens.find((row) => row.id === focus);
    const hypothesis = spec.hypotheses.some((row) => row.id === focus);
    // "Verbatim" is only true of public quotes; the maker's own notes were never checked against a source.
    const checkedNote = (numbers: number[]) => (numbers.every((n) => input.evidence[n - 1]?.platform !== 'own') ? t('원문과 일치', 'verbatim') : t('일부는 내 메모', 'some are your notes'));
    const names = (ids: string[], rows: Array<{ id: string; title?: string; name?: string }>) => ids.map((id) => `${id} ${rows.find((row) => row.id === id)?.title ?? rows.find((row) => row.id === id)?.name ?? ''}`.trim()).join(', ');
    const rows: Array<[string, React.ReactNode]> = [];
    let kind = '';
    let title = '';
    let body = '';
    if (quote) {
      kind = t('개발자 원문', 'Developer quote');
      title = PLATFORM_LABELS[quote.platform];
      body = quote.quote;
      rows.push([t('출처', 'Source'), <a key="source" href={quote.url} target="_blank" rel="noopener noreferrer" className="font-medium text-seed underline-offset-4 hover:underline">{t('원문', 'Source')}</a>]);
    } else if (requirement) {
      kind = hypothesis ? t('가설', 'Hypothesis') : t('요구사항', 'Requirement');
      title = requirement.title;
      body = requirement.detail;
      rows.push([t('근거', 'Evidence'), hypothesis ? t('원문 없음', 'No quote') : <span key="evidence" className="font-medium text-seed">{requirement.evidence.map((n) => `E${n}`).join(', ')} ({checkedNote(requirement.evidence)})</span>]);
      rows.push([t('근거 강도', 'Evidence strength'), strengthText(requirement)]);
      rows.push([t('기능', 'Features'), names(spec.features.filter((row) => row.requirementIds.includes(requirement.id)).map((row) => row.id), spec.features) || '-']);
    } else if (feature) {
      kind = t('기능', 'Feature');
      title = feature.title;
      body = feature.detail;
      const evidence = [...new Set(spec.requirements.filter((row) => feature.requirementIds.includes(row.id)).flatMap((row) => row.evidence))].sort((a, b) => a - b);
      rows.push([t('요구사항', 'Requirements'), names(feature.requirementIds, [...spec.requirements, ...spec.hypotheses]) || '-']);
      rows.push([t('근거', 'Evidence'), evidence.length ? <span key="evidence" className="font-medium text-seed">{evidence.map((n) => `E${n}`).join(', ')} ({checkedNote(evidence)})</span> : t('원문 없음', 'No quote')]);
      rows.push([t('화면', 'Screens'), names(spec.screens.filter((row) => row.featureIds.includes(feature.id)).map((row) => row.id), spec.screens) || '-']);
    } else if (screen) {
      kind = t('화면', 'Screen');
      title = screen.name;
      body = screen.does;
      rows.push([t('기능', 'Features'), names(screen.featureIds, spec.features) || '-']);
    } else return null;

    return (
      <section aria-live="polite" aria-label={t('고른 항목', 'Selected item')}>
        <p className="text-[13px] text-muted"><span className="font-semibold">{focus}</span> <span className="ml-1.5">{kind}</span></p>
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
        {/* Shown even where the chat takes general change requests: this one names a single item. */}
        {!quote && signedIn !== false && (
          <form className="mt-5" onSubmit={(event) => { event.preventDefault(); const text = itemInstruction.trim(); if (text.length < 2) return; setItemInstruction(''); void revise(t(`${focus} "${title}" 항목만 고칩니다. 다른 항목은 글자 하나 바꾸지 않습니다. 요청: ${text}`, `Change only ${focus} "${title}"; leave every other item exactly as it is. Request: ${text}`), `${focus}: ${text}`); }}>
            <label htmlFor="prd-item-revise" className="text-[13px] font-semibold">{t('이 항목만 고치기', 'Change just this item')}</label>
            <div className="mt-1.5 flex gap-2">
              <input id="prd-item-revise" value={itemInstruction} maxLength={200} onChange={(event) => setItemInstruction(event.target.value)} disabled={busy} placeholder={t('예: 수락 기준을 숫자로 바꿔줘', 'e.g. Make the acceptance criteria measurable')} className="h-10 min-w-0 flex-1 rounded-lg border border-field bg-white px-3 text-[13.5px]" />
              <button type="submit" className="btn-quiet h-10 px-3 text-[13px]" disabled={busy || itemInstruction.trim().length < 2}>{status === 'revising' ? t('고치는 중', 'Revising') : t('고치기', 'Apply')}</button>
            </div>
          </form>
        )}
        {feature && (
          <>
            <h4 className="mt-7 flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
              <span>{t('개발 준비', 'Build readiness')}</span>
              <span className="text-[12.5px] font-normal text-muted">{t('에이전트가 먼저 물어볼 것', 'What your agent will ask first')}</span>
            </h4>
            {feature.slots ? (
              <dl className="rows mt-3 text-sm">
                {SLOT_KEYS.map((key) => (
                  <div key={key} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt>{slotLabels(lang)[key]}</dt>
                      <dd className={slotIsOpen(feature.slots![key]) ? 'text-muted' : 'font-medium text-seed'}>{slotIsOpen(feature.slots![key]) ? t('확인 필요', 'Needs review') : t('채움', 'Filled')}</dd>
                    </div>
                    <dd className="mt-1 text-[13px] leading-6 text-muted [overflow-wrap:anywhere]">{feature.slots![key].length ? feature.slots![key].join('; ') : t('정해지지 않음: 먼저 물어볼 것', 'Open question: ask first')}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {slotsNeedReview(feature.slots) && (
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
    ['problem', t('배경', 'Background'), true],
    ['requirements', t('요구사항', 'Requirements'), true],
    ['features', t('기능', 'Features'), spec.features.length > 0],
    ['screens', t('화면', 'Screens'), spec.screens.length > 0],
    ['non-goals', t('범위 밖', 'Out of scope'), true],
    ['risks', t('위험 요소', 'Risks'), spec.risks.length > 0],
    ['assumptions', t('가정', 'Assumptions'), Boolean(spec.assumptions?.length)],
    ['done', t('성공 지표', 'Success metrics'), true],
    ['questions', t('열린 질문', 'Open questions'), Boolean(spec.openQuestions?.length)],
    ['toolkit', t('추천 도구와 점검', 'Tools and checks'), true],
  ] : [];
  const toolkit = spec ? recommendToolkit(spec) : [];
  const bullets = (rows: string[], render: (row: string) => React.ReactNode = (row) => row) => rows.length
    ? <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-[15px] leading-7 marker:text-outline-strong">{rows.map((row) => <li key={row}>{render(row)}</li>)}</ul>
    : <p className="mt-3 text-[15px] leading-7 text-muted">{t('정의되지 않음', 'Not defined')}</p>;

  const agentPrompt = agentSlug ? t(
    `Seedup MCP의 generate_verified_prd로 "${agentSlug}"(${title}) PRD를 받아 AGENTS.md로 저장해 줘. 같은 slug로 get_next_task를 호출해 다음 기능 하나를 골라 줘. update_feature_status로 시작할 때 작업 중, 끝날 때 완료(확인 결과 포함) 또는 막힘을 보고해 줘.`,
    `Use Seedup MCP to generate_verified_prd for "${agentSlug}" (${title}) and save it as AGENTS.md. Call get_next_task with the same slug to pick the next feature. Use update_feature_status to report in_progress at the start and done with checks or blocked at the end.`,
  ) : '';
  const notesField = (
    <div>
      <label htmlFor="prd-notes" className="text-[15px] font-semibold">{t('내 의견', 'Your direction')} <span className="font-normal text-muted">{t('(선택)', '(optional)')}</span></label>
      <p className="mt-1 text-[13px] leading-6 text-muted">{t('누구를 위해, 꼭 넣을 기능, 뺄 것, 원하는 방향을 적으면 처음부터 반영합니다. 원문이 받쳐 주지 않는 내용은 가설로 표시됩니다.', 'Who it is for, must-haves, what to leave out, the direction you want. It shapes the draft; anything no quote backs is marked as a hypothesis.')}</p>
      <textarea id="prd-notes" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} placeholder={t('예: 1인 개발자용 CLI로 만들고, 첫 버전은 OpenAI와 Anthropic만 지원. 결제와 팀 기능은 빼기.', 'e.g. A CLI for solo developers; v1 supports only OpenAI and Anthropic. No payments or team features.')} className="mt-2 block w-full border bg-white px-3 py-2.5 text-[15px] leading-6" />
    </div>
  );
  const generateButton = signedIn === false ? (
    <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-11 whitespace-nowrap px-5">{spec ? t('로그인하고 다시 만들기', 'Sign in to make it again') : t('로그인하고 PRD 만들기', 'Sign in to make a PRD')}</Link>
  ) : (
    <button type="button" className="btn h-11 whitespace-nowrap px-5" disabled={(!customSource && !evidenceIds.length) || busy} onClick={generate}>
      {status === 'loading' ? t('PRD 작성 중', 'Writing the PRD') : spec ? t('이 의견으로 다시 만들기', 'Make it again with this') : generateLabel ?? (ready ? t('이 근거로 PRD 만들기', 'Make a PRD from this evidence') : t('가설 초안 PRD 만들기', 'Make a hypothesis-draft PRD'))}
    </button>
  );
  const stats: Array<[string, string, boolean, string]> = spec && input ? [
    [t('원문이 받쳐 주는 요구사항', 'Quote-backed requirements'), String(spec.requirements.length), true, ''],
    [t('원문 없는 가설', 'Unbacked hypotheses'), String(spec.hypotheses.length), false, t('원문이 받쳐 주지 않아 만들기 전에 사용자에게 확인할 줄', 'Lines no quote backs; confirm them with users first')],
    [t('기능', 'Features'), String(spec.features.length), false, ''],
    [t('화면', 'Screens'), String(spec.screens.length), false, ''],
    // Shown once something is filled: at 0 it read as a failing score rather than an optional next step.
    ...(ready6 ? [[t('완료 기준을 채운 기능', 'Features with done criteria'), `${ready6}/${spec.features.length}`, false, t('기능 명세 보기에서 기능마다 입력, 규칙, 오류, 권한, 데이터, 테스트 기준을 채울 수 있습니다', 'Fill inputs, rules, errors, permissions, data and tests per feature in the feature spec view')] as [string, string, boolean, string]] : []),
    ...(progress ? [[t('구현 완료', 'Built'), `${spec.features.filter((row) => progress[row.id]?.status === 'done').length}/${spec.features.length}`, true, t('코딩 에이전트가 완료로 보고한 기능', 'Reported done by a coding agent')] as [string, string, boolean, string]] : []),
  ] : [];
  // A picked line scrolls its first quote into view inside the evidence panel, so the panel follows the reader.
  const panelRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!trace) return;
    const first = Math.min(...trace.evidence);
    panelRef.current?.querySelector<HTMLElement>(`[data-quote="${first}"]`)?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [trace]);
  // On a phone a menu opens as a sheet above the tab bar, so it never runs off the screen's edge.
  const menu = 'z-50 mt-2 flex flex-col gap-0.5 rounded-xl border border-outline-soft bg-white p-1.5 shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:bottom-20 sm:absolute sm:right-0 sm:z-20 sm:w-72';

  // The quotes behind the PRD, always beside the document; a picked line dims the quotes it does not stand on.
  const evidencePanel = input && (
    <section aria-label={t('근거 원문', 'Evidence')}>
      <h3 className="flex items-baseline justify-between gap-3 text-[15px] font-semibold">
        {t(`근거 원문 ${input.evidence.length}건`, `${input.evidence.length} source quotes`)}
        {trace && <button type="button" onClick={() => setFocus(null)} className="text-[13px] font-medium text-seed underline-offset-4 hover:underline">{t('전체 보기', 'Show all')}</button>}
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">{input.evidence.some((row) => row.platform === 'own') ? t('공개 글은 원문과 글자 단위로 일치합니다. "내 메모·인터뷰"는 직접 들은 말이라 대조하지 않았습니다.', 'Public quotes match their source word for word. Your own notes were not checked.') : t('모두 원문과 글자 단위로 일치합니다. 문서의 줄을 누르면 그 줄이 기대는 원문만 남습니다.', 'Each matches its source word for word. Press a line in the document to keep only the quotes it stands on.')}</p>
      <ol ref={panelRef} className="mt-3 grid gap-2">
        {input.evidence.map((row, index) => {
          const on = !trace || trace.evidence.has(index + 1);
          return (
            <li key={row.id} data-quote={index + 1} className={`scroll-mt-4 rounded-xl border px-3.5 py-3 transition-[opacity,border-color,background-color] duration-200 ${on ? 'opacity-100' : 'opacity-35'} ${trace && on ? 'border-seed bg-seed-soft' : 'border-outline-soft bg-white'}`}>
              <p className="flex items-baseline justify-between gap-3 text-[12.5px] text-muted">
                <span><b className="mr-1.5 font-semibold text-seed">E{index + 1}</b>{PLATFORM_LABELS[row.platform]}{row.postedAt && <time dateTime={row.postedAt} className="ml-2">{new Date(row.postedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'short' })}</time>}</span>
                {row.url
                  ? <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center text-muted underline-offset-4 hover:text-ink hover:underline" aria-label={t(`E${index + 1} 원문 열기`, `Open E${index + 1} source`)}>{t('원문', 'Source')}</a>
                  : <span className="inline-flex min-h-8 items-center" title={t('직접 들은 말이라 공개 원문과 대조하지 않았습니다', 'Your own notes, not checked against a public post')}>{t('확인 안 됨', 'Unchecked')}</span>}
              </p>
              <button type="button" aria-pressed={focus === `E-${index + 1}`} onClick={() => pick(`E-${index + 1}`)} className="mt-0.5 block w-full rounded-md text-left">
                <q lang={row.platform === 'own' ? undefined : 'en'} className="block text-[14px] leading-6 text-ink [overflow-wrap:anywhere]">{row.quote}</q>
                {lang === 'ko' && row.quoteKo && <span className="mt-1 block text-[13px] leading-5 text-muted">{row.quoteKo}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <>
      {!hideControls && !spec && (
        <div className="card max-w-[52rem] p-5 sm:p-6">
          {signedIn !== false && notesField}
          <div className={`flex flex-wrap items-center gap-2 ${signedIn !== false ? 'mt-4' : ''}`}>
            {generateButton}
            {signedIn !== false && <ModelPicker models={models} />}
          </div>
          {signedIn === false && <p className="mt-3 text-[13px] text-muted">{t('로그인하면 하루 10개까지 무료로 만들 수 있습니다. 기본은 무료 모델입니다.', 'Free for up to 10 a day once you sign in. The free model is the default.')}</p>}
          {!ready && !customSource && evidenceIds.length > 0 && <p className="mt-3 text-[13px] text-muted">{t('원문이 기준(원문 3건, 플랫폼 2곳)에 못 미쳐, 모든 내용을 검증 전 가설로 표시한 초안으로 만듭니다.', 'The evidence is below the bar (3 quotes, 2 platforms), so this becomes a draft labeled as unverified.')}</p>}
        </div>
      )}
      {status === 'loading' && <LivePrd live={live} elapsed={elapsed} lang={lang} title={showTitle && !spec ? title : undefined} />}
      {/* What the parent shows before a PRD exists (the live draft, the quotes it will use). While the PRD is being
          written the writing takes its place, so the old draft never sits under the new document. */}
      {!spec && status !== 'loading' && children}
      <div aria-live="polite" className="text-sm text-muted [&>p]:mt-3">
        {needsLogin && <p><Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="font-medium text-seed underline underline-offset-4">{t('로그인', 'Sign in')}</Link>{t('하면 담은 근거를 유지한 채 이어갑니다.', ' to continue with the evidence you collected.')}</p>}
        {error && <p className="text-red-700">{error}</p>}
        {message && <p>{message}</p>}
      </div>

      {input && spec && (
        <section className="rise-in mt-6" aria-label={t('생성된 PRD', 'Generated PRD')}>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              {showTitle && <h2 className="text-2xl font-bold tracking-tight">{input.title}</h2>}
              <dl className={`flex flex-wrap gap-2 ${showTitle ? 'mt-3' : ''}`}>
                {spec.draft && <div className="rounded-lg bg-surface-mid px-3 py-1.5 text-[13px] font-semibold text-tertiary"><dt className="sr-only">{t('상태', 'Status')}</dt><dd>{t('가설 초안', 'Hypothesis draft')}</dd></div>}
                {spec.beginner && <div title={t('온보딩에서 입문자를 골라 기능을 2~3개로 줄이고 쉬운 말로 썼습니다', 'You picked beginner at onboarding, so it keeps 2 or 3 features in plain words')} className="rounded-lg bg-surface-mid px-3 py-1.5 text-[13px] font-semibold text-tertiary"><dt className="sr-only">{t('범위', 'Scope')}</dt><dd>{t('입문자용으로 줄임', 'Cut down for beginners')}</dd></div>}
                {stats.map(([label, value, green, why]) => (
                  <div key={label} title={why || undefined} className="flex items-baseline gap-1.5 rounded-lg bg-surface-mid px-3 py-1.5 text-[13px]">
                    <dt className="text-muted">{label}</dt>
                    <dd className={`num font-semibold ${green ? 'text-seed' : 'text-ink'}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!hideControls && (
                <details className="relative">
                  <summary className="btn-quiet h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">{t('다시 만들기', 'Make again')}</summary>
                  <div className="z-50 mt-2 rounded-xl border border-outline-soft bg-white p-4 shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:bottom-20 sm:absolute sm:right-0 sm:z-20 sm:w-[26rem]">
                    {signedIn !== false && notesField}
                    <div className={`flex flex-wrap items-center gap-2 ${signedIn !== false ? 'mt-3' : ''}`}>
                      {generateButton}
                      {signedIn !== false && <ModelPicker models={models} />}
                    </div>
                  </div>
                </details>
              )}
              <button type="button" className="btn-quiet h-11" disabled={(!ids.length && !markdown) || saveState === 'saving'} onClick={save}>
                {saveState === 'saved' ? t('북마크에 저장됨', 'Saved') : saveState === 'saving' ? t('저장 중', 'Saving') : t('북마크에 저장', 'Save')}
              </button>
              <details className="relative">
                <summary className="btn-quiet h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">{t('내보내기', 'Export')}</summary>
                <div className={menu}>
                  <button type="button" className={quietButton} onClick={() => void copy('PRD', markdown)}>{t('PRD 복사', 'Copy PRD')}</button>
                  <button type="button" className={quietButton} onClick={() => downloadText('PRD.md', markdown)}>{t('PRD.md 받기', 'Download PRD.md')}</button>
                  {spec.screens.length > 0 && <button type="button" className={quietButton} onClick={() => void copy('Mermaid', mermaidFlow(spec))}>{t('Mermaid 코드 복사', 'Copy Mermaid code')}</button>}
                </div>
              </details>
              {/* Everything that hands the PRD to a coding agent sits behind the one primary action. */}
              <details className="relative order-first sm:order-none">
                <summary className="btn h-11 cursor-pointer list-none px-4 [&::-webkit-details-marker]:hidden">{t('에이전트로 보내기', 'Send to agent')}</summary>
                <div className={menu}>
                  {(() => {
                    const toolLabel = (key: ExportFormat) => (key === 'cursor'
                      ? `Cursor (${EXPORT_FILES.cursor})`
                      : key === 'claude'
                        ? `Claude Code (${EXPORT_FILES.claude})`
                        : key === 'prompt'
                          ? t('Lovable·Bolt·v0 프롬프트', 'Lovable·Bolt·v0 prompt')
                          : EXPORT_FILES.agents);
                    const primaryBrief = renderAgentBrief(input, spec, primaryFormat, agentSlug);
                    const primaryLabel = pickedTool ? toolLabel(primaryFormat) : EXPORT_FILES[primaryFormat];
                    return (
                      <>
                        <button type="button" className={quietButton} onClick={() => void copy(primaryLabel, primaryBrief)}>{t(`${primaryLabel} 내용 복사`, `Copy ${primaryLabel}`)}</button>
                        <button type="button" className={quietButton} onClick={() => downloadText(EXPORT_FILES[primaryFormat].split('/').pop()!, primaryBrief)}>{t(`${primaryLabel} 받기`, `Download ${primaryLabel}`)}</button>
                        {agentPrompt && <button type="button" className={quietButton} onClick={() => void copy(t('MCP 시작 문장', 'MCP start prompt'), agentPrompt)}>{t('MCP로 시작하는 문장 복사', 'Copy the MCP start prompt')}</button>}
                        <details className="border-t border-outline-soft pt-1">
                          <summary className="cursor-pointer px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink">{t('다른 도구', 'Other tools')}</summary>
                          <div className="mt-1 flex flex-col gap-0.5">
                            {otherFormats.map((otherKey) => {
                              const otherBrief = renderAgentBrief(input, spec, otherKey, agentSlug);
                              const otherName = toolLabel(otherKey);
                              return (
                                <div key={otherKey} className="flex items-center justify-between gap-1">
                                  <button type="button" className={quietButton} onClick={() => { setFormat(otherKey); void copy(otherName, otherBrief); }}>{t(`${otherName} 복사`, `Copy ${otherName}`)}</button>
                                  <button type="button" className="shrink-0 rounded px-2 py-1 text-[12px] text-muted hover:bg-surface-low hover:text-ink" onClick={() => { setFormat(otherKey); downloadText(EXPORT_FILES[otherKey].split('/').pop()!, otherBrief); }}>{t('받기', 'Download')}</button>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </>
                    );
                  })()}
                  <Link href="/agents" className="whitespace-nowrap px-3 py-2 text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline">{t('처음이면 MCP 연동부터', 'First time? Connect your agent')}</Link>
                </div>
              </details>
            </div>
          </div>

          {(spec.draft || spec.hypotheses.length > 0) && signedIn !== false && (
            <section aria-label={t('가설 확인하기', 'Check the hypotheses')} className="mt-5 rounded-2xl border border-outline-soft bg-surface-low px-5 py-4">
              <h3 className="text-[15px] font-semibold">{t(`원문이 받쳐 주지 않는 줄 ${spec.hypotheses.length}개를 확인하는 방법`, `How to check the ${spec.hypotheses.length} lines no quote backs`)}</h3>
              <p className="mt-1 text-[13.5px] leading-6 text-tertiary">{t('가설마다 아래 문서의 확인 방법을 따르거나, 근거가 쌓이게 해 두세요. 근거가 생기면 다시 만들 때 요구사항으로 올라갑니다.', 'Follow the check written under each hypothesis below, or let evidence build up. With evidence, the next PRD turns them into requirements.')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <WatchIdeaButton idea={title} className="btn-quiet h-10 px-4 text-sm" />
                <Link href="/profile#idea-pages" className="btn-quiet h-10 px-4 text-sm">{t('소개 페이지로 대기자 모으기', 'Collect a waitlist with a landing page')}</Link>
                <Link href="/guide#extension" className="inline-flex min-h-10 items-center px-2 text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline">{t('읽던 글에서 원문 담기', 'Save quotes from posts you read')}</Link>
              </div>
            </section>
          )}

          <details className="mt-4 text-sm text-muted">
            <summary className="cursor-pointer">{t('용어 풀이', 'What the labels mean')}</summary>
            <dl className="mt-2 grid gap-1 [&_dt]:font-semibold [&_dt]:text-ink sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
              <dt>PRD</dt><dd>{t('무엇을 누구를 위해 왜 만드는지 정리한 기획 문서', 'A plan of what to build, for whom and why')}</dd>
              <dt>E</dt><dd>{t('원문: 실제 사람이 공개 글에 쓴 문장', 'Evidence: a sentence a real person wrote in a public post')}</dd>
              <dt>R</dt><dd>{t('요구사항: 원문이 말하는, 해결돼야 하는 것', 'Requirement: what the quotes say must be solved')}</dd>
              <dt>F</dt><dd>{t('기능: 요구사항을 해결하려고 만드는 것', 'Feature: what you build to meet a requirement')}</dd>
              <dt>S</dt><dd>{t('화면: 사용자가 기능을 만나는 곳', 'Screen: where users meet a feature')}</dd>
              <dt>H</dt><dd>{t('가설: 원문이 뒷받침하지 않아 사용자에게 먼저 확인할 것', 'Hypothesis: no quote backs it yet, so check with users first')}</dd>
            </dl>
          </details>

          <div className="tabs mt-6" role="tablist" aria-label={t('PRD 보기 방식', 'PRD view')}>
            {VIEWS.map(([key, label, labelEn]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} className="tab" onClick={() => setView(key)}>{t(label, labelEn)}</button>
            ))}
          </div>

          <div className="mt-8 page-split">
            <div className="min-w-0">
              {spec.existing && spec.existing.length > 0 && (
                <details className={`${styles.existing} mb-6`} open>
                  <summary>{t(`기존 구조 ${spec.existing.length}개: 새 기능이 깨면 안 되는 것`, `Existing structure (${spec.existing.length}): new work must not break it`)}</summary>
                  <ul>{spec.existing.map((row) => <li key={row.name}><b>{row.name}</b>{row.does ? `: ${row.does}` : ''}</li>)}</ul>
                </details>
              )}

              {view === 'doc' && (
                <div className="grid gap-x-10 xl:grid-cols-[140px_minmax(0,1fr)]">
                  <nav className="hidden self-start text-sm xl:sticky xl:top-6 xl:block" aria-label={t('목차', 'Contents')}>
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
                      <p className="mt-1 text-[15px] leading-7">{spec.targetUsers.length ? prose(spec.targetUsers.join(', ')) : t('정의되지 않음', 'Not defined')}</p>
                      {spec.scenario && <><p className="label mt-5">{t('사용 장면', 'Scenario')}</p><p className="mt-1 text-[15px] leading-7">{spec.scenario}</p></>}
                      {spec.goals?.length ? <><p className="label mt-5">{t('목표', 'Goals')}</p>{bullets(spec.goals)}</> : null}
                    </section>
                    <section>
                      <h4 id="prd-problem" className={h2}>{t('배경', 'Background')}</h4>
                      {spec.background ? (
                        <>
                          <p className="mt-3 text-[15px] leading-7">{taggedProse(spec.background)}</p>
                          <details className="mt-3 text-[13px] text-muted">
                            <summary className="cursor-pointer">{t('처음 입력한 문제', 'The problem as entered')}</summary>
                            <p className="mt-2 whitespace-pre-line leading-6">{input.problem}</p>
                            {input.gap && <p className="mt-2 leading-6">{input.gap}</p>}
                          </details>
                        </>
                      ) : (
                        <>
                          <p className="mt-3 text-[15px] leading-7">{input.problem}</p>
                          {input.gap && <p className="mt-3 text-[15px] leading-7 text-tertiary">{input.gap}</p>}
                        </>
                      )}
                    </section>
                    <section>
                      <h4 id="prd-requirements" className={h2}>{t('요구사항', 'Requirements')}</h4>
                      {/* Backed and unbacked lines read in one list, as a PRD does; the unbacked ones say so and how to check them. */}
                      {spec.requirements.length + spec.hypotheses.length ? (
                        <ul className="rows mt-3">
                          {spec.requirements.map((row) => docRow(row.id, <>{priorityBadge(row.priority)}{row.title}{cites(row.evidence)}{row.detail && <span className="block text-sm leading-6 text-muted">{row.detail}</span>}{acceptanceLines(row.acceptance)}</>))}
                          {spec.hypotheses.map((row, index) => docRow(row.id, <>{priorityBadge(row.priority)}{row.title}<span className="ml-2 rounded border border-dashed border-outline-strong px-1.5 py-px align-[2px] text-[11.5px] font-semibold text-tertiary">{t('가설', 'Hypothesis')}</span>{index === 0 && <span className="ml-1.5 text-[12.5px] font-normal text-muted">({t('아직 확인 안 된 것: 원문 근거가 없어 직접 확인이 필요합니다', 'Not verified yet: no source quote, so check this directly')})</span>}{row.detail && <span className="block text-sm leading-6 text-muted">{row.detail}</span>}{acceptanceLines(row.acceptance)}{row.check && <span className="mt-1.5 block rounded-lg bg-surface-low px-2.5 py-1.5 text-[13.5px] leading-6 text-ink"><b className="font-semibold">{t('확인 방법', 'How to check')}</b> {row.check}</span>}</>))}
                        </ul>
                      ) : <p className="mt-3 text-[15px] leading-7 text-muted">{t('요구사항이 없습니다.', 'No requirements.')}</p>}
                    </section>
                    {spec.features.length > 0 && (
                      <section>
                        <h4 id="prd-features" className={h2}>{t('기능', 'Features')}</h4>
                        <ul className="rows mt-3">{(() => {
                          const firstUnbackedFeatureId = spec.hypotheses.length === 0 ? spec.features.find((item) => !backed(item))?.id : null;
                          return spec.features.map((row) => {
                          const mark = progress?.[row.id];
                          const featureStatus = mark?.status ?? 'todo';
                          const events = progressHistory?.[row.id];
                          const commits = featureCommits?.[row.id];
                          const count = commits?.count ?? 0;
                          const commitLabel = t(`연결된 커밋 ${count}개`, `${count} linked ${count === 1 ? 'commit' : 'commits'}`);
                          return docRow(row.id, <>
                            {row.title}
                            {!backed(row) && <span className="ml-2 text-[13px] font-normal text-muted">{t('가설', 'Hypothesis')}{row.id === firstUnbackedFeatureId ? ` (${t('아직 확인 안 된 것: 원문 근거가 없어 직접 확인이 필요합니다', 'Not verified yet: no source quote, so check this directly')})` : ''}</span>}
                            {progress && <span className={`ml-2 text-[13px] font-semibold ${featureStatus === 'done' ? 'text-seed' : 'text-muted'}`} title={mark?.note || undefined}>
                              {featureStatus === 'done' && '✓ '}{t(...STATUS_LABELS[featureStatus])}
                            </span>}
                            <span className="block text-sm leading-6 text-muted">{row.detail} ({t(`${row.requirementIds.join(', ')} 충족`, `serves ${row.requirementIds.join(', ')}`)})</span>
                          </>, !backed(row), <>
                            {featureCommits && (commits?.files.length ? (
                              <details className="mb-3 ml-12 text-[13px] text-muted">
                                <summary className="cursor-pointer">{commitLabel}{t(`, 파일 ${commits.files.length}개`, `, ${commits.files.length} ${commits.files.length === 1 ? 'file' : 'files'}`)}</summary>
                                <ul className="mt-1 space-y-1">
                                  {commits.files.map((file) => <li key={file}><code className="break-all">{file}</code></li>)}
                                </ul>
                              </details>
                            ) : <p className="mb-3 ml-12 text-[13px] text-muted">{commitLabel}</p>)}
                            {events?.length ? (
                              <details className="mb-3 ml-12 text-[13px] text-muted">
                                <summary className="cursor-pointer">{t('상태 이력', 'Status history')}</summary>
                                <ol className="mt-1 space-y-1">
                                  {events.map((event) => <li key={event.id} className="break-words">
                                    <time dateTime={event.createdAt}>{progressDate.format(new Date(event.createdAt))}</time>
                                    {' · '}{t(...STATUS_LABELS[event.status])}{event.note && ` · ${event.note}`}
                                  </li>)}
                                </ol>
                              </details>
                            ) : null}
                          </>);
                        });
                        })()}</ul>
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
                    {spec.risks.length > 0 && (
                      <section>
                        <h4 id="prd-risks" className={h2}>{t('위험 요소', 'Risks')}</h4>
                        {bullets(spec.risks, taggedProse)}
                      </section>
                    )}
                    {spec.assumptions?.length ? (
                      <section>
                        <h4 id="prd-assumptions" className={h2}>{t('가정', 'Assumptions')}</h4>
                        <p className="mt-1 text-[13px] text-muted">{t('증명되지 않았지만 이 계획이 기대는 것입니다. 틀리면 계획이 바뀝니다.', 'Not proven, but the plan leans on them. If one is wrong, the plan changes.')}</p>
                        {bullets(spec.assumptions, taggedProse)}
                      </section>
                    ) : null}
                    <section>
                      <h4 id="prd-done" className={h2}>{t('성공 지표', 'Success metrics')}</h4>
                      {bullets(spec.metrics)}
                    </section>
                    {spec.openQuestions?.length ? (
                      <section>
                        <h4 id="prd-questions" className={h2}>{t('열린 질문', 'Open questions')}</h4>
                        <p className="mt-1 text-[13px] text-muted">{t('아직 정하지 않은 결정입니다. 만들기 전에 답을 정하세요.', 'Decisions not made yet. Settle them before building.')}</p>
                        {bullets(spec.openQuestions)}
                      </section>
                    ) : null}
                    <section>
                      <h4 id="prd-toolkit" className={h2}>{t('추천 도구와 점검', 'Tools and checks')}</h4>
                      <p className="mt-1 text-[13px] text-muted">{t('검토한 목록에서 이 PRD의 내용에 맞는 것만 골랐습니다. 자동으로 설치하지 않으며, AGENTS.md에도 들어갑니다.', 'Picked from a reviewed list by the words in this PRD. Nothing is installed; the list also goes into AGENTS.md.')}</p>
                      {(['build', 'before-deploy', 'after-deploy'] as const).map((stage) => {
                        const rows = toolkit.filter((row) => row.tool.stage === stage);
                        return rows.length ? (
                          <div key={stage} className="mt-4">
                            <p className="label">{stage === 'build' ? t('만들 때', 'While building') : stage === 'before-deploy' ? t('배포 전 점검', 'Before deploy') : t('배포 후 점검', 'After deploy')}</p>
                            <ul className="mt-2 grid gap-2 text-[15px] leading-7">
                              {rows.map(({ tool, features }) => (
                                <li key={tool.id}>
                                  <a href={tool.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-seed underline-offset-4 hover:underline">{tool.name}</a>
                                  <span className="text-tertiary">: {t(tool.why[0], tool.why[1])}</span>
                                  {features.length > 0 && <span className="ml-1 text-[13px] text-muted">({features.join(', ')})</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null;
                      })}
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
                          <span className={styles.specId}>E{index + 1} {PLATFORM_LABELS[row.platform]}</span>
                          <q lang="en">{row.quote.length > 140 ? `${row.quote.slice(0, 140)}…` : row.quote}</q>
                        </button>
                      ))}
                    </div>
                    <div className={styles.specCol}>
                      <h4>{t('요구사항', 'Requirements')}</h4>
                      {spec.requirements.map((row) => item(row.id, <><span>{row.title}</span><small>{strengthText(row)} · {row.evidence.map((n) => `E-${n}`).join(', ')}</small></>))}
                      {spec.hypotheses.map((row) => item(row.id, <><span>{row.title}</span><small>{t('가설', 'Hypothesis')} · {strengthText(row)}</small></>, styles.specHypo))}
                    </div>
                    <div className={styles.specCol}>
                      <h4>
                        {t('기능', 'Features')}
                        {spec.features.some((row) => slotsNeedReview(row.slots)) && <button type="button" className="font-medium text-seed underline-offset-4 hover:underline" onClick={() => void fillAll()}>{t('빈 칸 모두 채우기', 'Fill all blanks')}</button>}
                      </h4>
                      {spec.features.map((row) => item(row.id, <><span>{row.title}</span><small>{t(`${row.requirementIds.join(', ')} 충족`, `Serves ${row.requirementIds.join(', ')}`)}, {slotPending.includes(row.id) ? t('채우는 중', 'filling') : slotsNeedReview(row.slots) ? t('개발 준비 확인 필요', 'readiness needs review') : t('개발 준비 채움', 'readiness filled')}</small></>, backed(row) ? '' : styles.specHypo))}
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
                      <span className={styles.specId}>{requirement.id}</span> <b className="font-semibold">{requirement.title}</b> <small>({requirement.evidence.length ? requirement.evidence.map((n) => `E-${n}`).join(', ') : t('가설, 원문 없음', 'hypothesis, no quote')})</small>
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

              {(view === 'wire' || view === 'flow') && !spec.screens.length && (
                <div className="rounded-2xl border border-dashed border-outline-strong px-6 py-8">
                  <p className="text-[15px] font-semibold">{t('아직 화면 설계가 없습니다', 'No screens designed yet')}</p>
                  <p className="mt-1 text-[14px] leading-6 text-muted">{t('문서를 먼저 확인하고, 기능이 맞으면 화면을 설계하세요. 기능마다 어느 화면에 나오는지, 사용자가 어떤 순서로 만나는지 만듭니다.', 'Check the document first; once the features look right, design the screens: which screen shows each feature and the order users meet them.')}</p>
                  <button type="button" className="btn mt-4 h-11 px-5" disabled={status !== 'idle'} onClick={() => void designScreens()}>{status === 'revising' ? t('설계하는 중', 'Designing') : t('화면 설계 만들기', 'Design the screens')}</button>
                </div>
              )}

              {view === 'wire' && spec.screens.length > 0 && <Wireframes spec={spec} focus={focus} pick={pick} lang={lang} />}

              {view === 'flow' && spec.screens.length > 0 && (
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

            <aside className="page-side lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-1">
              {detail && (
                <div>
                  {detail}
                  <button type="button" onClick={() => setFocus(null)} className="mt-4 text-[13px] font-medium text-seed underline-offset-4 hover:underline">{t('선택 해제', 'Clear selection')}</button>
                </div>
              )}
              {evidencePanel}
              {!hideRevise && signedIn !== false && <form onSubmit={(event) => { event.preventDefault(); void revise(); }}>
                <label htmlFor="prd-revise" className="text-[15px] font-semibold">{t('수정 요청', 'Request a change')}</label>
                <p className="mt-1 text-[13px] text-muted">{t('고친 내용도 원문 검사를 다시 거칩니다.', 'Changes go through the source check again.')}</p>
                <textarea id="prd-revise" rows={3} value={instruction} maxLength={300} onChange={(event) => setInstruction(event.target.value)} placeholder={t('예: 타겟을 초보 개발자로 좁혀줘', 'e.g. Narrow the target to beginner developers')} disabled={busy} className="mt-3 block w-full border bg-white px-3 py-2.5 text-sm leading-6" />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="submit" className="btn-quiet" disabled={busy || instruction.trim().length < 2}>{status === 'revising' ? t('고치는 중', 'Revising') : t('요청 보내기', 'Send request')}</button>
                  {previous && <button type="button" className="text-sm font-medium text-seed underline-offset-4 hover:underline" onClick={undo} disabled={busy}>{t('되돌리기', 'Undo')}</button>}
                </div>
              </form>}
              {versions.length > 1 && (
                <details>
                  <summary className="cursor-pointer text-[15px] font-semibold">{t(`버전 기록 ${versions.length}개`, `${versions.length} versions`)}</summary>
                  <ol className="mt-3 grid gap-2">
                    {versions.map((version, index) => (
                      <li key={`${version.at}-${index}`} className="rounded-lg border border-outline-soft px-3 py-2 text-[13px]">
                        <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold text-ink">{t(`버전 ${index + 1}`, `Version ${index + 1}`)}</span><span className="min-w-0 truncate text-muted">{version.label}</span>{index === versions.length - 1 && <span className="text-seed">{t('지금', 'Current')}</span>}</p>
                        <p className="mt-1 flex flex-wrap gap-x-3">
                          {index > 0 && <button type="button" className="text-seed underline-offset-4 hover:underline" onClick={() => setCompare(compare === index ? null : index)}>{compare === index ? t('바뀐 줄 닫기', 'Hide changes') : t('바뀐 줄 보기', 'Show changes')}</button>}
                          {index < versions.length - 1 && <button type="button" className="text-seed underline-offset-4 hover:underline" disabled={busy} onClick={() => restore(index)}>{t('이 버전으로', 'Use this version')}</button>}
                        </p>
                        {compare === index && diff && (
                          <ul className="mt-2 grid gap-0.5 font-mono text-[12px] leading-5">
                            {diff.length ? diff.slice(0, 60).map((line, n) => <li key={n} className={line.kind === 'added' ? 'text-seed' : 'text-red-700 line-through'}>{line.kind === 'added' ? '+ ' : '- '}{line.text}</li>) : <li className="text-muted">{t('바뀐 줄이 없습니다.', 'No lines changed.')}</li>}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </aside>
          </div>
        </section>
      )}
    </>
  );
}
