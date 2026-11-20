'use client';

import Link from 'next/link';
import { ViewTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, RotateCcw } from 'lucide-react';
import IdeaComposer from '@/components/IdeaComposer';
import WatchIdeaButton from '@/components/WatchIdeaButton';
import ModelPicker from '@/components/ModelPicker';
import { Bubble, Stages } from '@/components/WorkSplit';
import PrdBuilder, { forgetStoredPrd } from '@/components/opportunity-stage/PrdBuilder';
import GoalLock from '@/components/goal/GoalLock';
import { readValidationPrdInput, VALIDATION_HANDOFF_KEY } from '@/components/ValidationReportPanel';
import type { PrdModel } from '@/lib/opportunities/models';
import type { Spec } from '@/lib/opportunities/spec';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { ideaAudience } from '@/lib/ideas/input';
import { matchOpportunities } from '@/lib/opportunities/match';
import { assessPushback, pushbackText, suggestDirections, type DirectionSource } from '@/lib/opportunities/pushback';
import { MIN_EVIDENCE, MIN_PLATFORMS, PLATFORM_LABELS } from '@/lib/opportunities/types';
import type { Platform } from '@/lib/opportunities/types';

export type PoolItem = {
  slug: string;
  name: string;
  problem: string;
  keywords: string[];
  qualified: boolean;
  quotes: Array<{ id: string; platform: Platform; quote: string; quoteKo: string; url: string }>;
};
export type WorkspacePoolItem = PoolItem & DirectionSource & { competitorNotes: string[] };

type FixedQuestion = { key: string; ko: string; en: string; hintKo?: string; hintEn?: string; chips: Array<[string, string]> };
/** One question as the chat shows it, in the reader's language: fixed, or written for this idea by the server. */
type Question = { key: string; text: string; hint?: string; chips: string[] };
type Plan = { idea: string; questions: Question[] };
/** A quote found on the web for this idea; the server signed it, so the PRD route will accept it as evidence. */
type LiveQuote = PoolItem['quotes'][number] & { score: number; postedAt: string | null; sig: string };
type Search = { state: 'idle' | 'busy' | 'done' | 'error'; message?: string };
type Saved = { idea: string; answers: Record<string, string>; kept: string[]; touched: boolean; live?: LiveQuote[]; plan?: Plan; own?: string[]; competitors?: string[] };
type Note = { id: number; role: 'user' | 'assistant'; text: string };

const STORAGE_KEY = 'seedup:idea-workspace';
const MAX_MATCHED_PROBLEMS = 3;
const MAX_KEPT = 12;

// Asked when no model writes questions for the idea in time, and for answers saved before questions were tailored.
const QUESTIONS: FixedQuestion[] = [
  { key: 'users', ko: '누가 가장 먼저 쓰나요?', en: 'Who uses it first?', hintKo: '한 부류로 좁힐수록 PRD가 날카로워집니다.', hintEn: 'The narrower, the sharper the PRD.', chips: [['1인 개발자', 'Solo developers'], ['작은 개발팀', 'Small dev teams'], ['입문 개발자·학생', 'Beginners and students'], ['개발자가 아닌 실무자', 'Non-developers at work']] },
  { key: 'pain', ko: '그 사람이 지금 가장 불편한 점은 무엇인가요?', en: 'What hurts them most today?', hintKo: '아래는 개발자들이 실제로 말한 불편입니다.', hintEn: 'Below are problems developers actually wrote about.', chips: [] },
  { key: 'now', ko: '지금은 그 문제를 어떻게 버티고 있나요?', en: 'How do they cope today?', chips: [['직접 코드를 짜서', 'They write their own code'], ['여러 도구를 오가며', 'They juggle several tools'], ['문서·엑셀로 손수', 'By hand in docs or sheets'], ['그냥 포기한다', 'They give up']] },
  { key: 'must', ko: '첫 버전에 꼭 있어야 할 기능은 무엇인가요?', en: 'What must the first version do?', hintKo: '세 가지 이내로 적어 주세요.', hintEn: 'Three things at most.', chips: [] },
  { key: 'platform', ko: '어디에서 쓰게 할까요?', en: 'Where will people use it?', chips: [['웹', 'Web'], ['모바일 앱', 'Mobile app'], ['CLI', 'CLI'], ['에디터 확장', 'Editor extension'], ['Slack·Discord 봇', 'Slack or Discord bot']] },
  { key: 'out', ko: '이번 버전에서 하지 않을 것은 무엇인가요?', en: 'What will this version not do?', chips: [['결제', 'Payments'], ['팀 협업', 'Team collaboration'], ['모바일 앱', 'Mobile app'], ['다국어', 'Other languages']] },
  { key: 'extra', ko: '그 밖에 PRD에 꼭 반영할 생각이 있나요?', en: 'Anything else the PRD must reflect?', hintKo: '방향, 기술 선택, 피하고 싶은 것 등 무엇이든 좋습니다.', hintEn: 'Direction, tech choices, things to avoid: anything goes.', chips: [] },
];
const EXTRA = QUESTIONS[QUESTIONS.length - 1];

const fixedQuestion = (row: FixedQuestion, en: boolean, audience?: string | null): Question => {
  const baseChips = row.chips.map(([ko, enLabel]) => (en ? enLabel : ko));
  const chips = row.key === 'users' && audience && !baseChips.some((chip) => chip.toLowerCase() === audience.toLowerCase())
    ? [audience, ...baseChips]
    : baseChips;
  return { key: row.key, text: en ? row.en : row.ko, hint: en ? row.hintEn : row.hintKo, chips };
};

// [short name ko, short name en, the idea ko, the idea en]
const EXAMPLES: Array<[string, string, string, string]> = [
  ['LLM 교체 도구', 'LLM switch', '여러 LLM 제공사를 코드 수정 없이 바꿔 쓰는 개발 도구', 'A dev tool to switch LLM providers without code changes'],
  ['에이전트 가드레일', 'Agent guardrails', 'AI 에이전트의 서버, DB 접근을 안전하게 막아 주는 가드레일', 'Guardrails that keep AI agents away from servers and databases'],
  ['GIF 검색 API', 'GIF search API', '서비스 종료된 Tenor 대신 앱에 넣을 GIF 검색 API', 'A GIF search API to replace the shut-down Tenor'],
];

const readSaved = (): Saved | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
};

/**
 * A short planning chat that fills a PRD as you answer. The difference from a plain AI writer: every idea is matched
 * against verbatim developer quotes, and only lines those quotes back are allowed to count as evidence.
 */
export default function IdeaWorkspace({ pool, signedIn, initialIdea, models }: { pool: WorkspacePoolItem[]; signedIn: boolean; initialIdea: string; models: PrdModel[] }) {
  const lang = useLang();
  const t = translator(lang);
  const en = lang === 'en';

  const [idea, setIdea] = useState(initialIdea);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [kept, setKept] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [restored, setRestored] = useState(false);
  const [semantic, setSemantic] = useState<{ query: string; slugs: string[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [pane, setPane] = useState<'chat' | 'doc'>('chat');
  const [side, setSide] = useState<'chat' | 'quotes'>('chat');
  const [signal, setSignal] = useState(0);
  const [change, setChange] = useState<{ id: number; text: string } | null>(null);
  const [pending, setPending] = useState<'generate' | 'revise' | null>(null);
  const [generated, setGenerated] = useState(false);
  // The PRD the goal is drafted from, its saved dossier as a project key (`prd:<id>`), and whether a goal is locked.
  const [spec, setSpec] = useState<Spec | null>(null);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [goalLocked, setGoalLocked] = useState(false);
  const [reviewRequested, setReviewRequested] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [live, setLive] = useState<LiveQuote[]>([]);
  const [search, setSearch] = useState<Search>({ state: 'idle' });
  const searchVersion = useRef(0);
  // Questions written for this idea; null while they are being written, then the fixed list if none came back.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planFailed, setPlanFailed] = useState(false);
  // Sentences the maker heard in interviews or wrote down: shown as their own notes, never counted for the bar.
  const [own, setOwn] = useState<string[]>([]);
  // Competitors carried over from the validation report entry.
  const [validationCompetitors, setValidationCompetitors] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // Come back to the same answers after signing in, unless the address brought a different idea.
  // Browser storage only exists after mount, so this is a one-time sync from an external store.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = readSaved();
    let restoredKept: string[] = [];
    let restoredLive: LiveQuote[] = [];
    if (saved && (!initialIdea || saved.idea === initialIdea)) {
      setIdea(saved.idea);
      setAnswers(saved.answers ?? {});
      restoredKept = saved.kept ?? [];
      setKept(restoredKept);
      setTouched(Boolean(saved.touched));
      restoredLive = Array.isArray(saved.live) ? saved.live : [];
      setLive(restoredLive);
      setOwn(Array.isArray(saved.own) ? saved.own : []);
      if (Array.isArray(saved.competitors)) setValidationCompetitors(saved.competitors);
      if (saved.plan?.idea === saved.idea) setPlan(saved.plan);
      // Answers saved before questions were tailored belong to the fixed list.
      else if (saved.answers && Object.keys(saved.answers).length) setPlanFailed(true);
    }
    let storedValidation: string | null = null;
    try {
      storedValidation = window.sessionStorage.getItem(VALIDATION_HANDOFF_KEY);
    } catch {
      storedValidation = null;
    }
    const incoming = readValidationPrdInput(initialIdea, window.location.search, storedValidation, pool);
    if (incoming) {
      if (incoming.liveQuotes.length) {
        const mergedLive = [...incoming.liveQuotes, ...restoredLive.filter((row) => !incoming.liveQuotes.some((next) => next.id === row.id))].slice(0, MAX_KEPT);
        setLive(mergedLive);
      }
      if (incoming.evidenceIds.length) {
        setKept([...new Set([...incoming.evidenceIds, ...restoredKept])].slice(0, MAX_KEPT));
        setTouched(true);
      }
      if (incoming.competitors.length) setValidationCompetitors(incoming.competitors);
      try { window.sessionStorage.removeItem(VALIDATION_HANDOFF_KEY); } catch { /* ignore */ }
    }
    setRestored(true);
  }, [initialIdea, pool]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sentences saved with the browser extension, offered next to the web finds; nothing is kept until the person picks it.
  const [saved, setSavedQuotes] = useState<LiveQuote[]>([]);
  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/quotes').then((response) => (response.ok ? response.json() : { quotes: [] })).then((json: { quotes?: LiveQuote[] }) => setSavedQuotes(json.quotes ?? [])).catch(() => undefined);
  }, [signedIn]);

  // Instant keyword matches; meaning-based matches replace them when the embedding answers.
  useEffect(() => {
    if (idea.length < 2) return;
    const controller = new AbortController();
    fetch(`/api/opportunities/match?q=${encodeURIComponent(idea)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((json: { slugs?: string[] | null }) => { if (Array.isArray(json.slugs)) setSemantic({ query: idea, slugs: json.slugs }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [idea]);

  const matched = useMemo(() => {
    if (!idea) return [];
    // A meaning-based answer is trusted even when empty: "nothing close" must not fall back to the keyword match, which
    // pairs ideas on one shared word and would keep unrelated quotes as evidence.
    const semanticSlugs = semantic?.query === idea ? semantic.slugs : null;
    const slugs = semanticSlugs ?? matchOpportunities(idea, pool).slugs;
    const rank = (slug: string) => slugs.indexOf(slug);
    return pool.filter((item) => slugs.includes(item.slug))
      .sort((a, b) => (semanticSlugs ? rank(a.slug) - rank(b.slug) : Number(b.qualified) - Number(a.qualified)))
      .slice(0, MAX_MATCHED_PROBLEMS);
  }, [idea, semantic, pool]);

  // Until the user picks by hand, every quote of the closest problem is kept.
  const keptIds = useMemo(() => (touched ? kept : matched[0]?.quotes.map((row) => row.id) ?? []), [touched, kept, matched]);
  useEffect(() => {
    if (!restored) return;
    try {
      if (idea) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, answers, kept: keptIds, touched, live, own, ...(validationCompetitors.length ? { competitors: validationCompetitors } : {}), ...(plan ? { plan } : {}) } satisfies Saved));
    } catch {
      // Private mode or full storage: the chat still works, it just will not survive a reload.
    }
  }, [restored, idea, answers, keptIds, touched, live, plan, own, validationCompetitors]);

  // Once per idea: questions about what this idea leaves open, with options from it and its closest quotes.
  const planFor = useRef('');
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    if (!restored || !idea || plan?.idea === idea || planFailed || planFor.current === idea) return;
    planFor.current = idea;
    const quotes = matchOpportunities(idea, pool).slugs.flatMap((slug) => pool.find((item) => item.slug === slug)?.quotes ?? []).slice(0, 4).map((row) => row.quote);
    fetch('/api/ideas/questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea, quotes, lang }) })
      .then((response) => (response.ok ? response.json() : { questions: null }))
      .then((json: { questions?: Array<{ key: string; question: string; why: string; options: string[] }> | null }) => {
        if (planFor.current !== idea) return;
        if (!json.questions?.length || Object.keys(answersRef.current).length > 0) return setPlanFailed(true);
        setPlan({ idea, questions: json.questions.map((row) => ({ key: row.key, text: row.question, hint: row.why, chips: row.options })) });
      })
      .catch(() => { if (planFor.current === idea) setPlanFailed(true); });
  }, [restored, idea, plan, planFailed, pool, lang]);

  const offered = useMemo(() => [...live, ...saved.filter((row) => !live.some((item) => item.id === row.id))], [live, saved]);
  const quoteById = useMemo(() => new Map<string, PoolItem['quotes'][number]>([...pool.flatMap((item) => item.quotes.map((row) => [row.id, row] as const)), ...offered.map((row) => [row.id, row] as const)]), [pool, offered]);
  const keptLive = useMemo(() => offered.filter((row) => keptIds.includes(row.id)), [offered, keptIds]);
  const evidenceIds = useMemo(() => keptIds.filter((id) => !id.startsWith('lv_')), [keptIds]);
  const keptQuotes = useMemo(() => [...evidenceIds.flatMap((id) => quoteById.get(id) ?? []), ...keptLive].slice(0, MAX_KEPT), [evidenceIds, keptLive, quoteById]);
  const keptPlatforms = new Set(keptQuotes.map((row) => row.platform)).size;
  const passes = keptQuotes.length >= MIN_EVIDENCE && keptPlatforms >= MIN_PLATFORMS;

  // Show fixed questions right away while waiting for the model. Once tailored questions arrive, switch to them only if
  // the person has not answered any fixed question yet; otherwise keep the fixed list so their answers never disappear.
  const audience = useMemo(() => ideaAudience(idea, lang), [idea, lang]);
  const useTailored = Boolean(
    !planFailed
    && plan?.idea === idea
    && !Object.keys(answers).some((key) => !plan.questions.some((q) => q.key === key) && key !== EXTRA.key),
  );
  const questions = useMemo<Question[]>(
    () => (useTailored && plan ? [...plan.questions, fixedQuestion(EXTRA, en)] : QUESTIONS.map((row) => fixedQuestion(row, en, audience))),
    [useTailored, plan, en, audience],
  );
  const planning = Boolean(idea) && !questions.length;
  const step = questions.findIndex((question) => !(question.key in answers));
  const current = step === -1 ? null : questions[step];
  const answered = questions.filter((question) => answers[question.key]).length;

  const brief = useMemo(() => {
    const answeredRows = questions.filter((question) => answers[question.key]).map((question) => ({ key: question.key, question: question.text, answer: answers[question.key] }));
    const extraCompetitors = validationCompetitors.length
      ? [{ key: 'validation_competitors', question: en ? 'Competitors found in validation report' : '검증 리포트에서 찾은 경쟁 도구', answer: validationCompetitors.join('; ').slice(0, 400) }]
      : [];
    return { idea, answers: [...answeredRows, ...extraCompetitors].slice(0, 8) };
  }, [idea, answers, questions, validationCompetitors, en]);

  const selectedProblems = useMemo(() => {
    const evidenceOrder = new Map(evidenceIds.map((id, index) => [id, index]));
    return pool.map((item) => {
      const positions = item.quotes.flatMap(({ id }) => evidenceOrder.get(id) ?? []);
      return { item, count: positions.length, first: Math.min(...positions) };
    }).filter(({ count }) => count).sort((a, b) => b.count - a.count || a.first - b.first).map(({ item }) => item);
  }, [evidenceIds, pool]);
  const findings = generated || pending ? [] : assessPushback(idea, brief.answers, keptQuotes, [...new Set([...validationCompetitors, ...selectedProblems.flatMap((item) => item.competitorNotes)])].slice(0, 8));
  const showingReview = findings.length > 0 && (!current || reviewRequested);
  const directions = showingReview ? suggestDirections(idea, pool, [...new Set([...matched, ...selectedProblems].map((item) => item.slug))]) : [];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [idea, answers, notes, pending, matched.length, showingReview]);

  const say = (role: Note['role'], text: string) => {
    const id = nextId.current++;
    setNotes((list) => [...list, { id, role, text }]);
  };

  const send = (value: string) => {
    const text = value.trim();
    if (!text) return;
    setDraft('');
    if (!idea) {
      setIdea(text.slice(0, 300));
      return;
    }
    if (current) {
      setAnswers((before) => {
        const next = { ...before, [current.key]: text.slice(0, 400) };
        answersRef.current = next;
        return next;
      });
      return;
    }
    if (generated && pending === null) {
      say('user', text);
      setPending('revise');
      setChange({ id: nextId.current++, text: text.slice(0, 300) });
      setPane('doc');
    }
  };

  const startGeneration = () => {
    setPending('generate');
    setSignal((n) => n + 1);
    setPane('doc');
  };

  const generate = () => {
    if (findings.length) {
      setReviewRequested(true);
      return;
    }
    startGeneration();
  };

  const chooseDirection = (direction: string, quoteIds: string[]) => {
    searchVersion.current++;
    setIdea(direction.slice(0, 300));
    setAnswers({});
    answersRef.current = {};
    setDraft('');
    setKept(quoteIds);
    setTouched(true);
    setLive([]);
    setOwn([]);
    setSearch({ state: 'idle' });
    setPlan(null);
    setPlanFailed(false);
    planFor.current = '';
    setReviewRequested(false);
  };

  const reset = () => {
    if (Object.keys(answers).length && !window.confirm(t('답한 내용이 모두 지워집니다. 새로 시작할까요?', 'All your answers will be cleared. Start over?'))) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* nothing saved */ }
    searchVersion.current++;
    forgetStoredPrd(idea);
    setIdea('');
    setAnswers({});
    setKept([]);
    setTouched(false);
    setLive([]);
    setSearch({ state: 'idle' });
    setNotes([]);
    setPlan(null);
    setPlanFailed(false);
    setReviewRequested(false);
    setOwn([]);
    setValidationCompetitors([]);
    planFor.current = '';
    setGenerated(false);
    setSpec(null);
    setProjectKey(null);
    setGoalLocked(false);
    setPending(null);
    setPane('chat');
  };

  const toggle = (id: string) => {
    setTouched(true);
    setKept(keptIds.includes(id) ? keptIds.filter((row) => row !== id) : [...keptIds, id].slice(0, MAX_KEPT));
  };

  const loginNext = `/prd/new?idea=${encodeURIComponent(idea)}`;

  // Web search for quotes the stored ones do not cover. What it finds is kept right away; the person can still drop it.
  // Each search sends the phrases earlier ones tried for this idea, so the next one uses other words; when the first
  // automatic search falls short of the bar, one more runs right away with them.
  const tried = useRef<{ idea: string; phrases: string[] }>({ idea: '', phrases: [] });
  const searchWeb = async (retry = false, kept = keptIds, known: LiveQuote[] = live) => {
    const version = ++searchVersion.current;
    if (tried.current.idea !== idea) tried.current = { idea, phrases: [] };
    setSearch({ state: 'busy', ...(retry ? { message: t('다른 표현으로 한 번 더 찾는 중입니다.', 'Searching once more with other words.') } : {}) });
    try {
      const response = await fetch('/api/opportunities/evidence-search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea, avoid: tried.current.phrases }) });
      const json = await response.json().catch(() => ({}));
      if (searchVersion.current !== version) return;
      if (!response.ok) {
        setSearch({ state: 'error', message: json.error ?? t('찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not search. Try again shortly.') });
        return;
      }
      const phrases = (Array.isArray(json.phrases) ? json.phrases : []).filter((row: unknown): row is string => typeof row === 'string');
      tried.current = { idea, phrases: [...tried.current.phrases, ...phrases].slice(-6) };
      const found = (Array.isArray(json.quotes) ? json.quotes : []) as LiveQuote[];
      const next = [...kept, ...found.map((row) => row.id).filter((id) => !kept.includes(id))].slice(0, MAX_KEPT);
      setLive((before) => [...before, ...found.filter((row) => !before.some((old) => old.id === row.id))]);
      setTouched(true);
      setKept(next);
      const rows = [...known, ...found];
      const keptRows = next.flatMap((id) => quoteById.get(id) ?? rows.find((row) => row.id === id) ?? []);
      const short = keptRows.length < MIN_EVIDENCE || new Set(keptRows.map((row) => row.platform)).size < MIN_PLATFORMS;
      if (!retry && short && phrases.length) return void searchWeb(true, next, rows);
      setSearch({ state: 'done', message: found.length || retry ? t(`원문 ${keptRows.length}건을 근거로 담았습니다.${short ? ' 기준에는 못 미쳐 원문이 없는 줄은 가설로 표시됩니다.' : ''}`, `Kept ${keptRows.length} quotes as evidence.${short ? ' Still short of the bar, so unbacked lines become hypotheses.' : ''}`) : t('웹에서도 맞는 원문을 찾지 못했습니다. 답변만으로 만들면 요구사항은 가설로 표시됩니다.', 'No matching quote on the web either. A PRD from your answers marks requirements as hypotheses.') });
    } catch {
      if (searchVersion.current !== version) return;
      setSearch({ state: 'error', message: t('연결이 끊겼습니다. 다시 시도해 주세요.', 'Connection lost. Try again.') });
    }
  };

  // A link the person found themselves; the server keeps only sentences that appear in that post word for word.
  const addLink = async (url: string, quote: string) => {
    const version = ++searchVersion.current;
    setSearch({ state: 'busy' });
    try {
      const response = await fetch('/api/opportunities/evidence-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, quote, idea }) });
      const json = await response.json().catch(() => ({}));
      if (searchVersion.current !== version) return false;
      if (!response.ok) {
        setSearch({ state: 'error', message: json.error ?? t('추가하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not add it. Try again shortly.') });
        return false;
      }
      const found = (Array.isArray(json.quotes) ? json.quotes : []) as LiveQuote[];
      setLive((before) => [...before, ...found.filter((row) => !before.some((old) => old.id === row.id))]);
      setTouched(true);
      setKept([...keptIds, ...found.map((row) => row.id).filter((id) => !keptIds.includes(id))].slice(0, MAX_KEPT));
      setSearch({ state: 'done', message: t(`그 글에서 원문 ${found.length}건을 확인하고 근거로 담았습니다.`, `Checked and kept ${found.length} quotes from that post.`) });
      return true;
    } catch {
      if (searchVersion.current !== version) return false;
      setSearch({ state: 'error', message: t('연결이 끊겼습니다. 다시 시도해 주세요.', 'Connection lost. Try again.') });
      return false;
    }
  };

  // Short of the evidence bar, look on the web once per idea without waiting to be asked: a PRD with quotes is the
  // point, and a person rarely finds the search button before writing. Signed-out visitors get a few a day too, so
  // they see evidence before they sign in.
  const searchedFor = useRef('');
  useEffect(() => {
    if (!restored || !idea || passes || search.state !== 'idle' || searchedFor.current === idea || live.length) return;
    searchedFor.current = idea;
    void searchWeb();
    // searchWeb reads the latest state when it runs; re-running on its identity would search again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, idea, passes, search.state, live.length]);

  const onPrdSaved = async (id: string) => {
    const key = `prd:${id}`;
    setProjectKey(key);
    const competitors = [...new Set([...validationCompetitors, ...selectedProblems.flatMap((item) => item.competitorNotes)])].slice(0, 8);
    const rows = brief.answers.filter((row) => row.key !== 'validation_competitors');
    const response = await fetch(`/api/projects/${encodeURIComponent(key)}/brief`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ competitors, answers: rows }) }).catch(() => null);
    return Boolean(response?.ok);
  };

  if (restored && !idea) {
    return <IdeaStart onSubmit={send} en={en} problems={pool.filter((item) => item.qualified)} />;
  }

  // The fixed "what hurts" question offers the matched problems; tailored questions bring their own options.
  const chips: string[] = current?.key === 'pain' && !current.chips.length ? matched.map((item) => item.problem) : current?.chips ?? [];
  const placeholder = planning ? t('이 아이디어에 맞는 질문을 고르는 중입니다', 'Choosing questions for this idea')
    : current ? t('직접 적거나 질문 아래에서 고르세요', 'Type, or pick one under the question')
    : generated ? t('고칠 점을 적어 주세요. 예: 타겟을 초보 개발자로 좁혀줘', 'Ask for a change, e.g. narrow it to beginners')
      : t('질문이 끝났습니다. PRD를 만들어 보세요.', 'Questions are done. Make the PRD.');

  // Where the work stands, left to right, so the person always knows the next step.
  const stages: Array<{ label: string; state: 'done' | 'now' | 'todo' }> = [
    { label: t('아이디어', 'Idea'), state: 'done' },
    // No quotes is a fact about the idea, not a step to do now: it never competes with the current question.
    { label: keptQuotes.length ? t(`근거 ${keptQuotes.length}건`, `${keptQuotes.length} quotes`) : t('근거 없음', 'No quotes'), state: keptQuotes.length ? 'done' : 'todo' },
    { label: planning ? t('질문 준비 중', 'Preparing questions') : t(`질문 ${answered}/${questions.length}`, `Questions ${answered}/${questions.length}`), state: current || planning ? 'now' : 'done' },
    { label: 'PRD', state: generated ? 'done' : current || planning ? 'todo' : 'now' },
    { label: t('목표', 'Goal'), state: goalLocked ? 'done' : generated ? 'now' : 'todo' },
    { label: t('에이전트', 'Agent'), state: goalLocked ? 'now' : 'todo' },
  ];
  const picker = <EvidencePicker matched={matched} live={live} saved={saved.filter((row) => !live.some((item) => item.id === row.id))} keptIds={keptIds} toggle={toggle} keptCount={keptQuotes.length} keptPlatforms={keptPlatforms} passes={passes} en={en} search={search} onSearch={() => void searchWeb()} onAddLink={addLink} signedIn={signedIn} loginNext={loginNext} idea={idea} own={own} setOwn={setOwn} />;
  const threeColumns = !generated;

  return (
    <div className="flex flex-col lg:h-dvh">
      <div className="flex min-h-14 items-center gap-4 border-b border-outline-soft bg-white px-4 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold md:hidden" title={idea}>{idea}</p>
        <Stages stages={stages} label={t('진행 단계', 'Progress')} />
        {/* The model is chosen before anything is written, so it sits in the bar for the whole session. */}
        {signedIn && <div className="hidden shrink-0 sm:block"><ModelPicker models={models} /></div>}
        {/* Phones see one pane at a time, so the make action also sits here, reachable from the chat. */}
        {!generated && (signedIn
          ? <button type="button" className="btn h-10 shrink-0 whitespace-nowrap px-3.5 lg:hidden" onClick={generate} disabled={pending !== null}>{t('PRD 만들기', 'Make PRD')}</button>
          : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-10 shrink-0 whitespace-nowrap px-3.5 lg:hidden">{t('로그인하고 PRD 만들기', 'Sign in to make the PRD')}</Link>)}
        <button type="button" onClick={reset} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-low hover:text-ink">
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />{t('새로 시작', 'Start over')}
        </button>
      </div>

      <div className="sticky top-14 z-30 flex border-b border-outline-soft bg-white lg:hidden" role="tablist" aria-label={t('보기', 'View')}>
        {([['chat', '대화', 'Chat'], ['doc', '문서', 'Document']] as const).map(([key, ko, enLabel]) => (
          <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)} className="tab flex-1 justify-center">{t(ko, enLabel)}</button>
        ))}
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <section aria-label={t('기획 대화', 'Planning chat')} className={`${pane === 'chat' ? 'flex' : 'hidden'} h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] flex-col border-outline-soft bg-white lg:order-1 lg:flex lg:h-auto lg:min-h-0 lg:border-r`}>
          {/* Wide screens: the panel switches between the chat and the quotes the PRD will stand on. */}
          {threeColumns && (
            <div className="hidden shrink-0 border-b border-outline-soft px-5 lg:flex" role="tablist" aria-label={t('패널', 'Panel')}>
              <div className="tabs border-b-0">
                <button type="button" role="tab" aria-selected={side === 'chat'} onClick={() => setSide('chat')} className="tab">{t('대화', 'Chat')}</button>
                <button type="button" role="tab" aria-selected={side === 'quotes'} onClick={() => setSide('quotes')} className="tab">{t('근거 원문', 'Quotes')} <span className="num">{keptQuotes.length}</span></button>
              </div>
            </div>
          )}
          {threeColumns && side === 'quotes' && <div className="hidden min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:block">{picker}</div>}
          <div ref={scroller} className={`min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 ${threeColumns && side === 'quotes' ? 'lg:hidden' : ''}`} aria-live="polite">
            <Bubble role="user">{idea}</Bubble>

            <Bubble role="assistant">
              {/* Phones pick quotes here; wide screens have the quotes tab in this panel. */}
              <div className={threeColumns ? 'lg:hidden' : ''}>{picker}</div>
              {threeColumns && (
                <p className="hidden lg:block">
                  {matched.length || keptQuotes.length
                    ? t(`이 아이디어와 맞는 원문 ${keptQuotes.length}건을 근거로 담았습니다. 근거 원문 탭에서 빼거나 더할 수 있습니다.`, `Kept ${keptQuotes.length} matching quotes as evidence. Add or drop them in the Quotes tab.`)
                    : t('저장된 원문 중 이 아이디어와 맞는 것은 아직 없습니다. 답변만으로도 만들 수 있고, 그때 요구사항은 모두 가설로 표시됩니다.', 'No stored quote matches this idea yet. Your answers alone can still make the PRD, with every requirement marked as a hypothesis.')}
                </p>
              )}
              {validationCompetitors.length > 0 && (
                <p className="mt-2 text-[13px] leading-5 text-muted [overflow-wrap:anywhere]">
                  {t(`검증 리포트의 경쟁 도구 ${validationCompetitors.length}개를 함께 반영합니다: ${validationCompetitors.join(', ')}`, `Using ${validationCompetitors.length} competitors from the validation report: ${validationCompetitors.join(', ')}`)}
                </p>
              )}
            </Bubble>

            {planning && (
              <Bubble role="assistant">
                <p className="flex items-center gap-2 text-muted"><span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-seed motion-reduce:animate-none" />{t('이 아이디어에서 아직 정해지지 않은 것을 찾아 질문을 고르는 중입니다.', 'Finding what this idea leaves open and choosing questions.')}</p>
              </Bubble>
            )}
            {questions.slice(0, step === -1 ? questions.length : step + 1).map((question) => (
              <div key={question.key} className="space-y-6">
                <Bubble role="assistant">
                  <p className="font-semibold text-ink">{question.text}</p>
                  {question.hint && question.key === current?.key && <p className="mt-1 text-[13px] text-muted">{question.hint}</p>}
                  {question.key === current?.key && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {chips.map((label) => (
                        <button key={label} type="button" onClick={() => send(label)} className="min-h-10 max-w-full rounded-2xl border border-outline-soft bg-white px-3.5 py-2 text-left text-[13px] leading-5 text-tertiary hover:border-outline-strong hover:text-ink">{label}</button>
                      ))}
                      {useTailored && question.key !== EXTRA.key && <button type="button" onClick={() => send(t('잘 모르겠어요. 원문과 아이디어에 맞게 정해 주세요.', 'Not sure. Decide what fits the idea and the quotes.'))} className="min-h-10 rounded-2xl border border-outline-soft bg-white px-3.5 text-[13px] text-tertiary hover:border-outline-strong hover:text-ink">{t('잘 모르겠어요', 'Not sure')}</button>}
                      <button type="button" onClick={() => setAnswers((before) => { const next = { ...before, [question.key]: '' }; answersRef.current = next; return next; })} className="min-h-10 rounded-2xl border border-dashed border-outline-strong px-3.5 text-[13px] text-tertiary hover:border-ink hover:text-ink">{t('건너뛰기', 'Skip')}</button>
                    </div>
                  )}
                </Bubble>
                {question.key in answers && (
                  <Bubble role="user" onEdit={() => setAnswers((before) => Object.fromEntries(Object.entries(before).filter(([key]) => questions.findIndex((row) => row.key === key) < questions.indexOf(question))))} editLabel={t('이 답부터 다시', 'Redo from here')}>
                    {answers[question.key] || <span className="text-muted">{t('건너뜀', 'Skipped')}</span>}
                  </Bubble>
                )}
              </div>
            ))}

            {showingReview && (
              <Bubble role="assistant">
                <h2 className="font-semibold text-ink">{t('이 부분은 근거와 다릅니다', 'Check these decisions against the evidence')}</h2>
                <ul className="mt-2 list-disc space-y-2 break-words pl-5 text-[14px]">
                  {findings.map((row) => <li key={`${row.kind}:${row.claim}`}>{pushbackText(row, lang)}</li>)}
                </ul>
                {directions.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">{t('다른 방향', 'Other directions')}</h3>
                    <p className="mt-1 text-sm text-muted">{t('방향을 바꾸면 새 원문을 담고 질문을 다시 시작합니다.', 'Choosing a new direction loads its quotes and starts the questions again.')}</p>
                    <ul className="mt-2 grid gap-2">
                      {directions.map((item) => (
                        <li key={item.slug} className="grid gap-1.5 rounded-lg border border-outline-soft p-3 text-[13px]">
                          <p className="break-words font-medium text-ink">{item.direction}</p>
                          <p className="text-muted">{t(`원문 ${item.evidenceCount}건 · 직접 경쟁 ${item.directCount}개`, `${item.evidenceCount} quotes · ${item.directCount} direct competitors`)}</p>
                          <button type="button" onClick={() => chooseDirection(item.direction, item.quotes.map(({ id }) => id))} className="btn-quiet h-9 justify-self-start px-3">{t('이 방향으로', 'Use this direction')}<span className="sr-only"> {item.name}</span></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-sm text-muted">{t('그대로 진행하면 위 항목을 검증할 가설로 PRD에 남깁니다.', 'Keep this direction to record these decisions as hypotheses in the PRD.')}</p>
                {signedIn
                  ? <button type="button" className="btn mt-2 h-10 px-4" onClick={startGeneration}>{t('그대로 진행', 'Keep this direction')}</button>
                  : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn mt-2 h-10 px-4">{t('로그인하고 그대로 진행', 'Sign in to keep this direction')}</Link>}
              </Bubble>
            )}

            {!current && !planning && !generated && !showingReview && (
              <Bubble role="assistant">
                <p>{t('질문이 끝났습니다. 지금 내용으로 PRD 문서를 만들까요? 문서를 먼저 쓰고, 화면 설계와 개발 준비 칸은 문서를 확인한 뒤 버튼 하나로 이어서 만듭니다.', 'That is everything. Write the PRD document now? The document comes first; screens and readiness slots follow with one click once you have checked it.')}</p>
                <p className={`mt-2 text-[14px] ${passes ? 'text-seed' : 'text-muted'}`}>
                  {passes
                    ? t(`근거 원문 ${keptQuotes.length}건이 기준을 넘었습니다. 원문이 받쳐 주는 줄은 요구사항으로 씁니다.`, `${keptQuotes.length} quotes pass the bar; lines they back become requirements.`)
                    : keptQuotes.length
                      ? t(`근거 원문이 ${keptQuotes.length}건이라 기준(${MIN_EVIDENCE}건, ${MIN_PLATFORMS}곳)에 못 미칩니다. 가설 초안으로 쓰고, 원문이 없는 줄마다 확인 방법을 붙입니다.`, `${keptQuotes.length} quotes is below the bar (${MIN_EVIDENCE} from ${MIN_PLATFORMS} sites). It becomes a hypothesis draft, with a way to check each unbacked line.`)
                      : t('근거 원문이 없어 모든 요구사항이 가설이 됩니다. 가설마다 누구에게 무엇을 물어 확인할지 함께 씁니다.', 'No quotes, so every requirement is a hypothesis. Each one comes with who to ask and what, to check it.')}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {signedIn && <div className="sm:hidden"><ModelPicker models={models} /></div>}
                  {signedIn
                    ? <button type="button" className="btn h-11 px-5" onClick={generate} disabled={pending === 'generate'}>{pending === 'generate' ? t('PRD 작성 중', 'Writing the PRD') : t('PRD 만들기', 'Make the PRD')}</button>
                    : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-11 px-5">{t('로그인하고 PRD 만들기', 'Sign in to make the PRD')}</Link>}
                </div>
                {!signedIn && <p className="mt-2 text-[13px] text-muted">{t('질문 답하기까지는 로그인 없이, PRD는 로그인하면 하루 10개까지 무료입니다. 답변은 이 브라우저에 남아 로그인한 뒤에도 그대로 이어집니다.', 'Answer questions with no account; sign in for 10 free PRDs a day. Your answers stay in this browser and carry over after sign-in.')}</p>}
              </Bubble>
            )}

            {generated && (
              <Bubble role="assistant">
                <p>{t('PRD를 만들었습니다. 오른쪽에서 문서, 기능 명세, 유저플로우, 와이어프레임을 확인하세요. 고칠 점은 여기에 적으면 바로 반영합니다.', 'The PRD is ready. See the document, feature spec, user flow and wireframes on the right. Type a change here and it is applied.')}</p>
                <p className="mt-2">{t('다음은 문서 맨 위의 목표 카드에서 목표와 성공 기준을 잠그는 일입니다.', 'Next, lock the goal and its success criteria in the goal card at the top of the document.')}</p>
              </Bubble>
            )}
            {notes.map((note) => <Bubble key={note.id} role={note.role}>{note.text}</Bubble>)}
            {pending && <p className="text-sm text-muted">{pending === 'generate' ? t('오른쪽에 PRD가 쓰이는 모습이 바로 보입니다. 보통 30초에서 2분 걸립니다.', 'The PRD is being written on the right as you watch. Usually 30 seconds to 2 minutes.') : t('수정 요청을 반영하는 중입니다.', 'Applying your change.')}</p>}
          </div>

          <div className="border-t border-outline-soft px-4 pb-4 pt-3">
            {!generated && !showingReview && (
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[13px] leading-5 text-muted">
                  {current || planning ? t('지금 만들면 답하지 않은 칸은 가설로 채워집니다', 'Make it now and unanswered parts are filled as hypotheses') : t('질문 끝', 'All answered')}
                </span>
                {signedIn
                  ? <button type="button" className="btn h-9 shrink-0 whitespace-nowrap px-3.5" onClick={generate} disabled={pending !== null}>{pending === 'generate' ? t('작성 중', 'Writing') : t('PRD 만들기', 'Make PRD')}</button>
                  : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-9 shrink-0 whitespace-nowrap px-3.5">{t('로그인하고 PRD 만들기', 'Sign in to make the PRD')}</Link>}
              </div>
            )}
            <form className="flex items-end gap-2 rounded-xl border border-field bg-white p-2 focus-within:border-ink" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
              <label htmlFor="idea-composer" className="sr-only">{t('답변 입력', 'Your answer')}</label>
              <textarea
                id="idea-composer"
                rows={1}
                value={draft}
                maxLength={400}
                disabled={!current && (!generated || pending !== null)}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Korean input commits on Enter too; sending mid-composition would cut the last syllable.
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                placeholder={placeholder}
                className="max-h-36 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none [field-sizing:content] placeholder:text-muted disabled:cursor-not-allowed"
              />
              <button type="submit" aria-label={t('보내기', 'Send')} disabled={!draft.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-muted">
                <ArrowUp aria-hidden="true" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        <section aria-label={t('PRD 문서', 'PRD document')} className={`${pane === 'doc' ? 'block' : 'hidden'} min-w-0 bg-white px-5 pb-28 pt-6 [scrollbar-width:thin] lg:order-2 lg:block lg:overflow-y-auto lg:px-10 lg:pb-10`}>
          {generated && spec && <GoalLock key={idea} spec={spec} idea={idea} projectKey={projectKey} onLocked={setGoalLocked} />}
          <PrdBuilder
            key={idea}
            title={idea}
            onSaved={onPrdSaved}
            projectKey={projectKey ?? undefined}
            showAgentHandoff={goalLocked}
            evidenceIds={keptIds}
            ready={passes}
            loginNext={loginNext}
            requestBody={{ brief, evidenceIds, liveEvidence: keptLive, ownNotes: own, title: idea }}
            models={models}
            hideRevise
            signedIn={signedIn}
            generateSignal={signal}
            externalInstruction={change}
            hideControls={!generated}
            onSpec={(next) => {
              setSpec(next);
              if (pending === 'revise') say('assistant', t('반영했습니다. 바뀐 곳은 오른쪽 문서와 그래프에서 확인할 수 있습니다.', 'Done. The document and graph on the right show what changed.'));
              setGenerated(true);
              setPending(null);
            }}
            onError={(message) => {
              setPending(null);
              say('assistant', message === 'login' ? t('로그인이 필요합니다. 답변은 그대로 남아 있습니다.', 'Please sign in. Your answers are kept.') : message);
            }}
          >
            {!generated && <LiveDraft idea={idea} questions={questions} answers={answers} current={current?.key ?? null} quotes={keptQuotes} passes={passes} en={en} found={matched[0]?.problem ?? ''} onOpenQuotes={() => { setSide('quotes'); setPane('chat'); }} />}
          </PrdBuilder>
        </section>

      </div>
    </div>
  );
}

/** The quotes found for the idea, to keep or drop, with the evidence bar they add up to. */
function EvidencePicker({ matched, live, saved, keptIds, toggle, keptCount, keptPlatforms, passes, en, search, onSearch, onAddLink, signedIn, loginNext, idea, own, setOwn }: { matched: PoolItem[]; live: LiveQuote[]; saved: LiveQuote[]; keptIds: string[]; toggle: (id: string) => void; keptCount: number; keptPlatforms: number; passes: boolean; en: boolean; search: Search; onSearch: () => void; onAddLink: (url: string, quote: string) => Promise<boolean>; signedIn: boolean; loginNext: string; idea: string; own: string[]; setOwn: (rows: string[]) => void }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  const [ownDraft, setOwnDraft] = useState('');
  const quoteRow = (row: PoolItem['quotes'][number]) => {
    const on = keptIds.includes(row.id);
    return (
      <li key={row.id}>
        <label className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 text-[13.5px] leading-6 transition-colors ${on ? 'border-seed bg-seed-soft' : 'border-outline-soft bg-white hover:border-outline-strong'}`}>
          <input type="checkbox" checked={on} onChange={() => toggle(row.id)} className="mt-1 h-4 w-4 shrink-0 accent-seed" />
          <span className="min-w-0">
            <q lang="en" className="line-clamp-3 text-ink">{row.quote}</q>
            {!en && row.quoteKo && <span className="mt-0.5 line-clamp-2 block text-muted">{row.quoteKo}</span>}
            <span className="mt-1 flex gap-3 text-xs text-muted">
              <span>{PLATFORM_LABELS[row.platform]}</span>
              <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>{t('원문 열기', 'Open source')}</a>
            </span>
          </span>
        </label>
      </li>
    );
  };
  const web = (
    <div className={matched.length || live.length || saved.length ? 'mt-6 border-t border-outline-soft pt-5' : 'mt-4'}>
      <p className="text-[14px] font-semibold text-ink">{t('웹에서 원문 더 찾기', 'Find more quotes on the web')}</p>
      <p className="mt-1 text-[13px] leading-5 text-muted">{t('GitHub 이슈, Hacker News, Stack Overflow와 생활 분야 Q&A 사이트에서 같은 불편을 말한 글을 찾아, 원문과 글자 단위로 맞는 문장만 가져옵니다. 다른 사람이 비슷한 아이디어로 찾아 둔 원문도 함께 봅니다. 30초에서 1분 걸립니다.', 'Searches GitHub issues, Hacker News, Stack Overflow and everyday Q&A sites for posts about the same problem, keeping only sentences that match the source word for word. Quotes found for similar ideas are checked too. Takes 30 to 60 seconds.')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSearch} disabled={search.state === 'busy'} className={`${matched.length || live.length ? 'btn-quiet' : 'btn'} h-10 whitespace-nowrap`}>{search.state === 'busy' ? t('웹에서 찾는 중', 'Searching the web') : live.length ? t('다른 표현으로 더 찾기', 'Search with other words') : t('웹에서 찾기', 'Search the web')}</button>
        {!signedIn && <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="text-[13px] text-tertiary underline underline-offset-2 hover:text-ink">{t('로그인 없이는 하루 4번까지', 'Up to 4 a day without signing in')}</Link>}
      </div>
      {signedIn && (
        <form
          className="mt-4 grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (await onAddLink(String(data.get('url') ?? ''), String(data.get('quote') ?? ''))) form.reset();
          }}
        >
          <label className="text-[13px] font-semibold text-ink" htmlFor="evidence-link">{t('직접 찾은 글 링크로 추가', 'Add a post you found')}</label>
          <input id="evidence-link" name="url" type="url" required placeholder="https://github.com/…/issues/123" className="h-10 rounded-lg border border-field bg-white px-3 text-[14px]" />
          <input name="quote" type="text" placeholder={t('담을 문장 (비우면 글에서 찾아 줍니다)', 'Sentence to keep (leave empty to find one)')} className="h-10 rounded-lg border border-field bg-white px-3 text-[14px]" />
          <button type="submit" disabled={search.state === 'busy'} className="btn-quiet h-10 justify-self-start whitespace-nowrap">{t('원문과 대조해 담기', 'Check and keep')}</button>
        </form>
      )}
      {search.message && <p className={`mt-2 text-[13px] leading-5 ${search.state === 'error' ? 'text-red-700' : 'text-tertiary'}`} role="status">{search.message}</p>}
    </div>
  );
  const ownNotes = (defaultOpen = false) => (
    <details className="mt-5 border-t border-outline-soft pt-4" open={defaultOpen || own.length > 0}>
      <summary className="cursor-pointer text-[14px] font-semibold text-ink">{t('내가 직접 들은 말 넣기', 'Add what you heard yourself')} <span className="font-normal text-muted">{t('인터뷰, 메모', 'interviews, notes')}{own.length ? ` · ${own.length}` : ''}</span></summary>
      <p className="mt-1.5 text-[13px] leading-5 text-muted">{t('한 줄에 한 문장씩 넣으세요. 공개 글과 대조할 수 없어 "내 메모"로 표시되고, 근거 기준(원문 3건, 2곳)에는 들어가지 않습니다.', 'One sentence per line. They cannot be checked against a public post, so they show as your notes and do not count toward the evidence bar.')}</p>
      {own.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {own.map((row) => (
            <li key={row} className="flex items-start justify-between gap-2 rounded-xl border border-outline-soft bg-white px-3 py-2 text-[13.5px] leading-6">
              <q className="min-w-0 text-ink">{row}</q>
              <button type="button" onClick={() => setOwn(own.filter((item) => item !== row))} className="shrink-0 text-[12.5px] text-muted hover:text-ink" aria-label={t('이 메모 빼기', 'Remove this note')}>{t('빼기', 'Remove')}</button>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-2" onSubmit={(event) => { event.preventDefault(); const lines = ownDraft.split('\n').map((line) => line.trim()).filter((line) => line.length >= 8); if (!lines.length) return; setOwn([...new Set([...own, ...lines])].slice(0, 10)); setOwnDraft(''); }}>
        <label htmlFor="own-notes" className="sr-only">{t('직접 들은 말', 'What you heard')}</label>
        <textarea id="own-notes" rows={3} value={ownDraft} maxLength={2000} onChange={(event) => setOwnDraft(event.target.value)} placeholder={t('예: 매주 월요일마다 깨진 빌드 원인을 찾느라 오전이 다 가요 (프론트엔드 개발자 인터뷰)', 'e.g. Every Monday my morning goes to finding why the build broke (frontend dev interview)')} className="block w-full rounded-lg border border-field bg-white px-3 py-2 text-[13.5px] leading-6" />
        <button type="submit" className="btn-quiet mt-2 h-9 px-3 text-[13px]" disabled={ownDraft.trim().length < 8 || own.length >= 10}>{t('담기', 'Add')}</button>
      </form>
    </details>
  );
  if (!matched.length && !live.length && !saved.length) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-ink">{t('저장된 원문 중 맞는 것이 없습니다', 'No stored quote matches yet')}</p>
        <div className="mt-3 rounded-xl border border-outline-soft bg-surface-low p-4 text-[13.5px] leading-6">
          <p className="text-ink">{t('Seedup은 개발자 커뮤니티(GitHub, HN, Stack Overflow 등)의 글을 모읍니다. 이 아이디어의 사용자는 다른 곳에 있을 가능성이 큽니다.', 'Seedup collects posts from developer communities (GitHub, HN, Stack Overflow, etc.). Your target users are likely elsewhere.')}</p>
          <p className="mt-1.5 text-muted">{t('이 상태로 만든 PRD는 모든 요구사항을 확인할 항목으로 남긴 "가설 초안"으로 만들어집니다.', 'A PRD made in this state becomes a "hypothesis draft" where every requirement is marked to be verified.')}</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-tertiary">
            <li>1. <a href="#own-notes" className="font-semibold text-seed underline-offset-4 hover:underline">{t('직접 들은 말 넣기', 'Add what you heard yourself')}</a> {t('(인터뷰·메모 입력 칸)', '(interview or note input below)')}</li>
            <li>2. <Link href="/guide#extension" className="font-semibold text-seed underline-offset-4 hover:underline">{t('크롬 확장으로 원문 담기', 'Save quotes with the Chrome extension')}</Link></li>
            <li className="flex flex-wrap items-center gap-2">
              <span>3. {t('지켜보기 등록:', 'Watch this idea:')}</span>
              {signedIn
                ? <WatchIdeaButton idea={idea} className="btn-quiet h-8 px-2.5 text-[12.5px]" />
                : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="font-semibold text-seed underline-offset-4 hover:underline">{t('로그인하고 지켜보기 등록', 'Sign in to watch this idea')}</Link>}
            </li>
          </ul>
        </div>
        {web}
        {ownNotes(true)}
      </div>
    );
  }
  const meters: Array<[string, number, number]> = [[t('원문', 'Quotes'), keptCount, MIN_EVIDENCE], [t('플랫폼', 'Platforms'), keptPlatforms, MIN_PLATFORMS]];
  return (
    <div>
      <p className="text-[15px] font-semibold text-ink">{t('근거로 쓸 원문', 'Quotes to use as evidence')}</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {meters.map(([label, value, bar]) => (
          <div key={label}>
            <p className="flex items-baseline justify-between text-[13px] text-muted"><span>{label}</span><span><b className={`num text-[15px] font-semibold ${value >= bar ? 'text-seed' : 'text-ink'}`}>{value}</b>{t(` / 기준 ${bar}`, ` / bar ${bar}`)}</span></p>
            <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-high"><span className="block h-full origin-left rounded-full bg-seed transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${Math.min(1, value / bar)})` }} /></span>
          </div>
        ))}
      </div>
      <p className={`mt-2 text-[13px] leading-5 ${passes ? 'font-semibold text-seed' : 'text-muted'}`}>{passes ? t('기준을 넘었습니다. 원문이 받쳐 주는 요구사항은 근거로 표시됩니다.', 'Above the bar: requirements the quotes back count as evidence.') : t('기준에 못 미치면 PRD는 가설 초안으로 만들어집니다.', 'Below the bar the PRD is made as a hypothesis draft.')}</p>
      <div className="mt-5 space-y-5">
        {matched.map((item) => (
          <div key={item.slug}>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Link href={`/opportunities/${item.slug}`} target="_blank" className="text-[14px] font-semibold text-ink underline-offset-4 hover:underline">{item.name}</Link>
              {item.qualified && <span className="text-[12.5px] font-semibold text-seed">{t(`원문 ${MIN_EVIDENCE}건, ${MIN_PLATFORMS}곳 이상`, `${MIN_EVIDENCE}+ quotes, ${MIN_PLATFORMS}+ sites`)}</span>}
            </p>
            <ul className="mt-2 space-y-1.5">{item.quotes.map(quoteRow)}            </ul>
          </div>
        ))}
        {saved.length > 0 && (
          <div>
            <p className="text-[14px] font-semibold text-ink">{t('확장으로 담은 원문', 'Saved with the extension')}</p>
            <ul className="mt-2 space-y-1.5">{saved.map(quoteRow)}</ul>
          </div>
        )}
        {live.length > 0 && (
          <div>
            <p className="text-[14px] font-semibold text-ink">{t('웹에서 찾은 원문', 'Found on the web')}</p>
            <ul className="mt-2 space-y-1.5">{live.map(quoteRow)}</ul>
          </div>
        )}
      </div>
      {web}
      {ownNotes(false)}
      {signedIn && (
        <div className="mt-5 space-y-3 border-t border-outline-soft pt-4">
          {!passes && <p className="text-[13px] leading-5 text-muted">{t('근거가 아직 모자라면 지켜보세요. 매주 다시 찾아 새 원문과 경쟁 도구를 메일로 보냅니다.', 'Short on evidence? Watch it: Seedup searches again each week and mails new quotes and rival tools.')}</p>}
          <WatchIdeaButton idea={idea} className="btn-quiet h-9 px-3 text-[13px]" />
          {saved.length === 0 && <p className="text-[13px] leading-5 text-muted">{t('읽던 글에서 바로 문장을 담으려면 ', 'To save sentences straight from a page you are reading, ')}<Link href="/guide#extension" className="font-semibold text-seed underline-offset-4 hover:underline">{t('브라우저 확장 설치', 'install the browser extension')}</Link></p>}
        </div>
      )}
    </div>
  );
}

/** The document as the chat fills it, before the model writes the full PRD: nothing here is invented. */
function LiveDraft({ idea, questions, answers, current, quotes, passes, en, found, onOpenQuotes }: { idea: string; questions: Question[]; answers: Record<string, string>; current: string | null; quotes: PoolItem['quotes']; passes: boolean; en: boolean; found: string; onOpenQuotes: () => void }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  // One row per question asked, whatever the questions are; the matched problem fills in for the fixed "what hurts".
  const rows: Array<[string, string, string]> = questions.map((question) => [question.text, question.key, question.key === 'pain' && found ? t(`원문이 말하는 문제: ${found}`, `What the quotes describe: ${found}`) : question.hint ?? '']);
  const after = t('PRD를 만들면 요구사항, 기능, 화면이 이어진 기능 명세 그래프와 유저플로우, 와이어프레임이 함께 생깁니다. 원문이 받쳐 주지 않는 줄은 모두 가설로 남습니다.', 'Making the PRD adds the feature graph (requirement, feature, screen), user flow and wireframes. Lines no quote backs stay hypotheses.');
  return (
    <div className="mx-auto grid max-w-[1000px] gap-12 py-2 sm:py-4 xl:grid-cols-[minmax(0,720px)_200px] xl:justify-between">
      <article className="min-w-0">
        <ViewTransition name="idea-box" share="morph" default="none">
          <h2 className="text-[clamp(28px,3vw,40px)] font-bold leading-tight tracking-[-0.03em] [overflow-wrap:anywhere]">{idea}</h2>
        </ViewTransition>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <span>{t(`근거 원문 ${quotes.length}건`, `${quotes.length} quotes`)}</span>
          <span className={`inline-flex items-center gap-1 ${passes ? 'font-semibold text-seed' : ''}`}>
            {passes && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
            {passes ? t('근거 기준 통과', 'Evidence bar passed') : t('가설 초안', 'Hypothesis draft')}
          </span>
        </p>

        <div className="mt-8 border-b border-outline-soft">
          {rows.map(([label, key, hint]) => {
            const value = answers[key];
            const now = key === current;
            if (value === undefined && !now) {
              // Not reached yet: one quiet line, so the page reads as a document, not an empty form.
              return (
                <section key={key} id={`draft-${key}`} className="flex scroll-mt-6 items-baseline justify-between gap-4 border-t border-outline-soft py-3.5">
                  <h3 className="text-[15px] font-semibold text-tertiary">{label}</h3>
                  <span className="shrink-0 rounded-md border border-dashed border-outline-strong px-2 py-0.5 text-[12px] text-muted">{t('비어 있음', 'Empty')}</span>
                </section>
              );
            }
            return (
              <section key={key} id={`draft-${key}`} className="scroll-mt-6 border-t border-outline-soft py-5">
                <div className={now ? '-ml-[18px] border-l-2 border-seed pl-4' : ''}>
                  <h3 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
                    {label}
                    {now && <span className="text-[13px] font-semibold text-seed">{t('지금 질문', 'Asking now')}</span>}
                  </h3>
                  {value === undefined
                    ? <p className="mt-1.5 text-[15px] leading-7 text-muted">{hint}<span className="mt-0.5 block text-[13px]">{t('왼쪽 질문에 답하면 여기에 채워집니다.', 'Answer the question on the left to fill this in.')}</span></p>
                    : <p className={`mt-1.5 text-[16px] leading-7 ${value ? 'text-ink' : 'text-muted'}`}>{value || t('건너뜀', 'Skipped')}</p>}
                </div>
              </section>
            );
          })}
          <section id="draft-evidence" className="scroll-mt-6 border-t border-outline-soft py-5">
            <h3 className="text-[15px] font-semibold">{t('근거 원문', 'Evidence')}</h3>
            {quotes.length ? (
              <>
                <ol className="mt-3 grid gap-3">
                  {quotes.map((row, index) => (
                    <li key={row.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 border-l-2 border-seed pl-3 text-sm leading-6">
                      <span className="font-semibold text-seed">E{index + 1}</span>
                      <span className="min-w-0"><q lang="en" className="line-clamp-2">{row.quote}</q><span className="block text-xs text-muted">{PLATFORM_LABELS[row.platform]}</span></span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[13px] text-muted">
                  {passes ? t('원문이 받쳐 주는 요구사항은 근거로 표시됩니다.', 'Requirements the quotes back are marked as evidence.') : t(`원문 ${MIN_EVIDENCE}건, 플랫폼 ${MIN_PLATFORMS}곳 미만이면 가설 초안으로 만들어집니다.`, `Below ${MIN_EVIDENCE} quotes from ${MIN_PLATFORMS} platforms it is made as a hypothesis draft.`)}
                </p>
              </>
            ) : (
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-[15px] leading-7 text-muted">
                {t('담은 원문이 없어 요구사항은 모두 가설로 표시됩니다.', 'No quotes kept, so every requirement is a hypothesis.')}
                <button type="button" onClick={onOpenQuotes} className="link-seed text-[14px] font-semibold">{t('근거 원문 고르기', 'Pick quotes')}</button>
              </p>
            )}
          </section>
        </div>
        <p className="mt-6 text-[13px] leading-6 text-muted xl:hidden">{after}</p>
      </article>

      <aside className="hidden xl:block" aria-label={t('목차', 'Contents')}>
        <nav className="sticky top-2">
          <p className="text-[13px] font-semibold">{t('목차', 'Contents')}</p>
          <ol className="mt-3 grid gap-0.5">
            {[...rows.map(([label, key]) => [label, key] as const), [t('근거 원문', 'Evidence'), 'evidence'] as const].map(([label, key]) => {
              const state = key === current ? 'now' : key === 'evidence' ? (quotes.length ? 'done' : 'todo') : answers[key] !== undefined ? 'done' : 'todo';
              return (
                <li key={key}>
                  <a href={`#draft-${key}`} aria-current={state === 'now' ? 'step' : undefined} className={`flex min-h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors hover:bg-surface-low ${state === 'now' ? 'font-semibold text-seed' : state === 'done' ? 'text-ink' : 'text-muted'}`}>
                    {state === 'done'
                      ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-seed" strokeWidth={2.5} />
                      : <span aria-hidden="true" className={`mx-[3px] h-2 w-2 shrink-0 rounded-full ${state === 'now' ? 'bg-seed' : 'border border-outline-strong'}`} />}
                    <span className="truncate">{label}</span>
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 border-t border-outline-soft pt-4 text-[13px] leading-6 text-muted">{after}</p>
        </nav>
      </aside>
    </div>
  );
}

/** The empty state: one question and a few real examples, with problems that passed the bar right under it. */
function IdeaStart({ onSubmit, en, problems }: { onSubmit: (text: string) => void; en: boolean; problems: PoolItem[] }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  return (
    <div className="page-shell">
      <section aria-labelledby="idea-start-heading">
        <h1 id="idea-start-heading" className="page-intro-title md:text-[38px]">{t('한 줄 아이디어면 PRD가 시작돼요', 'One line of an idea starts the PRD')}</h1>
        <p className="page-intro-description">{t('짧은 질문에 답하고 내 의견을 더하면, 실제 개발자 원문을 근거로 PRD·기능 명세·유저플로우·와이어프레임을 만듭니다.', 'Answer a few questions, add your own view, and get a PRD, feature spec, user flow and wireframes grounded in real developer quotes.')}</p>
        <div className="mt-5 w-full"><IdeaComposer onSubmit={onSubmit} autoFocus examples={EXAMPLES.map(([shortKo, shortEn, ko, enText]) => ({ label: en ? shortEn : shortKo, idea: en ? enText : ko }))} /></div>
        <p className="mt-2 text-[13px] text-muted">{t('무료 모델 제공사가 입력을 기록 · 학습에 쓸 수 있습니다', 'Free model providers may record your input and use it for training.')} <Link href="/privacy" className="underline underline-offset-4">{t('처리방침', 'Privacy policy')}</Link></p>
      </section>
      {problems.length > 0 && (
        <section className="mt-10 pb-16" aria-labelledby="idea-start-problems">
          <h2 id="idea-start-problems" className="text-[17px] font-bold tracking-[-0.015em]">{t('또는 검증된 문제로 시작하기', 'Or start from a verified problem')}</h2>
          <p className="text-[13px] text-muted">{t(`원문 ${MIN_EVIDENCE}건, 플랫폼 ${MIN_PLATFORMS}곳을 넘은 문제입니다.`, `Problems with ${MIN_EVIDENCE}+ quotes from ${MIN_PLATFORMS}+ sites.`)}</p>
          <ul className="rows mt-3">
            {problems.map((item) => (
              <li key={item.slug}>
                <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="group flex min-h-16 items-center justify-between gap-6 py-3">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink underline-offset-4 group-hover:underline">{item.name}</span>
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{item.problem}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-seed">{t('PRD 만들기', 'Make a PRD')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
