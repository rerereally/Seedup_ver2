'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, RotateCcw } from 'lucide-react';
import IdeaComposer from '@/components/IdeaComposer';
import ModelPicker from '@/components/ModelPicker';
import PrdBuilder from '@/components/opportunity-stage/PrdBuilder';
import type { PrdModel } from '@/lib/opportunities/models';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { matchOpportunities } from '@/lib/opportunities/match';
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

type Question = { key: string; ko: string; en: string; hintKo?: string; hintEn?: string; chips: Array<[string, string]> };
/** A quote found on the web for this idea; the server signed it, so the PRD route will accept it as evidence. */
type LiveQuote = PoolItem['quotes'][number] & { score: number; postedAt: string | null; sig: string };
type Search = { state: 'idle' | 'busy' | 'done' | 'error'; message?: string };
type Saved = { idea: string; answers: Record<string, string>; kept: string[]; touched: boolean; live?: LiveQuote[] };
type Note = { id: number; role: 'user' | 'assistant'; text: string };

const STORAGE_KEY = 'seedup:idea-workspace';
const MAX_MATCHED_PROBLEMS = 3;
const MAX_KEPT = 12;

const QUESTIONS: Question[] = [
  { key: 'users', ko: '누가 가장 먼저 쓰나요?', en: 'Who uses it first?', hintKo: '한 부류로 좁힐수록 PRD가 날카로워집니다.', hintEn: 'The narrower, the sharper the PRD.', chips: [['1인 개발자', 'Solo developers'], ['작은 개발팀', 'Small dev teams'], ['입문 개발자·학생', 'Beginners and students'], ['개발자가 아닌 실무자', 'Non-developers at work']] },
  { key: 'pain', ko: '그 사람이 지금 가장 불편한 점은 무엇인가요?', en: 'What hurts them most today?', hintKo: '아래는 개발자들이 실제로 말한 불편입니다.', hintEn: 'Below are problems developers actually wrote about.', chips: [] },
  { key: 'now', ko: '지금은 그 문제를 어떻게 버티고 있나요?', en: 'How do they cope today?', chips: [['직접 코드를 짜서', 'They write their own code'], ['여러 도구를 오가며', 'They juggle several tools'], ['문서·엑셀로 손수', 'By hand in docs or sheets'], ['그냥 포기한다', 'They give up']] },
  { key: 'must', ko: '첫 버전에 꼭 있어야 할 기능은 무엇인가요?', en: 'What must the first version do?', hintKo: '세 가지 이내로 적어 주세요.', hintEn: 'Three things at most.', chips: [] },
  { key: 'platform', ko: '어디에서 쓰게 할까요?', en: 'Where will people use it?', chips: [['웹', 'Web'], ['모바일 앱', 'Mobile app'], ['CLI', 'CLI'], ['에디터 확장', 'Editor extension'], ['Slack·Discord 봇', 'Slack or Discord bot']] },
  { key: 'out', ko: '이번 버전에서 하지 않을 것은 무엇인가요?', en: 'What will this version not do?', chips: [['결제', 'Payments'], ['팀 협업', 'Team collaboration'], ['모바일 앱', 'Mobile app'], ['다국어', 'Other languages']] },
  { key: 'extra', ko: '그 밖에 PRD에 꼭 반영할 생각이 있나요?', en: 'Anything else the PRD must reflect?', hintKo: '방향, 기술 선택, 피하고 싶은 것 등 무엇이든 좋습니다.', hintEn: 'Direction, tech choices, things to avoid: anything goes.', chips: [] },
];

const EXAMPLES: Array<[string, string]> = [
  ['여러 LLM 제공사를 코드 수정 없이 바꿔 쓰는 개발 도구', 'A dev tool to switch LLM providers without code changes'],
  ['AI 에이전트의 서버·DB 접근을 안전하게 막아 주는 가드레일', 'Guardrails that keep AI agents away from servers and databases'],
  ['서비스 종료된 Tenor 대신 앱에 넣을 GIF 검색 API', 'A GIF search API to replace the shut-down Tenor'],
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
export default function IdeaWorkspace({ pool, signedIn, initialIdea, models }: { pool: PoolItem[]; signedIn: boolean; initialIdea: string; models: PrdModel[] }) {
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
  const [signal, setSignal] = useState(0);
  const [change, setChange] = useState<{ id: number; text: string } | null>(null);
  const [pending, setPending] = useState<'generate' | 'revise' | null>(null);
  const [generated, setGenerated] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [live, setLive] = useState<LiveQuote[]>([]);
  const [search, setSearch] = useState<Search>({ state: 'idle' });
  const scroller = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // Come back to the same answers after signing in, unless the address brought a different idea.
  // Browser storage only exists after mount, so this is a one-time sync from an external store.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = readSaved();
    if (saved && (!initialIdea || saved.idea === initialIdea)) {
      setIdea(saved.idea);
      setAnswers(saved.answers ?? {});
      setKept(saved.kept ?? []);
      setTouched(Boolean(saved.touched));
      setLive(Array.isArray(saved.live) ? saved.live : []);
    }
    setRestored(true);
  }, [initialIdea]);
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
    const semanticSlugs = semantic?.query === idea && semantic.slugs.length ? semantic.slugs : null;
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
      if (idea) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, answers, kept: keptIds, touched, live } satisfies Saved));
    } catch {
      // Private mode or full storage: the chat still works, it just will not survive a reload.
    }
  }, [restored, idea, answers, keptIds, touched, live]);

  const offered = useMemo(() => [...live, ...saved.filter((row) => !live.some((item) => item.id === row.id))], [live, saved]);
  const quoteById = useMemo(() => new Map<string, PoolItem['quotes'][number]>([...pool.flatMap((item) => item.quotes.map((row) => [row.id, row] as const)), ...offered.map((row) => [row.id, row] as const)]), [pool, offered]);
  const keptLive = offered.filter((row) => keptIds.includes(row.id));
  const keptQuotes = keptIds.flatMap((id) => quoteById.get(id) ?? []);
  const keptPlatforms = new Set(keptQuotes.map((row) => row.platform)).size;
  const passes = keptQuotes.length >= MIN_EVIDENCE && keptPlatforms >= MIN_PLATFORMS;

  const step = QUESTIONS.findIndex((question) => !(question.key in answers));
  const current = step === -1 ? null : QUESTIONS[step];
  const answered = QUESTIONS.filter((question) => answers[question.key]).length;

  const brief = useMemo(() => ({
    idea,
    answers: QUESTIONS.filter((question) => answers[question.key]).map((question) => ({ question: en ? question.en : question.ko, answer: answers[question.key] })),
  }), [idea, answers, en]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [idea, answers, notes, pending, matched.length]);

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
      setAnswers((before) => ({ ...before, [current.key]: text.slice(0, 400) }));
      return;
    }
    if (generated && pending === null) {
      say('user', text);
      setPending('revise');
      setChange({ id: nextId.current++, text: text.slice(0, 300) });
      setPane('doc');
    }
  };

  const generate = () => {
    setPending('generate');
    setSignal((n) => n + 1);
    setPane('doc');
  };

  const reset = () => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* nothing saved */ }
    setIdea('');
    setAnswers({});
    setKept([]);
    setTouched(false);
    setLive([]);
    setSearch({ state: 'idle' });
    setNotes([]);
    setGenerated(false);
    setPending(null);
    setPane('chat');
  };

  const toggle = (id: string) => {
    setTouched(true);
    setKept(keptIds.includes(id) ? keptIds.filter((row) => row !== id) : [...keptIds, id].slice(0, MAX_KEPT));
  };

  const loginNext = `/prd/new?idea=${encodeURIComponent(idea)}`;

  // Web search for quotes the stored ones do not cover. What it finds is kept right away; the person can still drop it.
  const searchWeb = async () => {
    setSearch({ state: 'busy' });
    try {
      const response = await fetch('/api/opportunities/evidence-search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSearch({ state: 'error', message: json.error ?? t('찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not search. Try again shortly.') });
        return;
      }
      const found = (Array.isArray(json.quotes) ? json.quotes : []) as LiveQuote[];
      setLive((before) => [...before, ...found.filter((row) => !before.some((old) => old.id === row.id))]);
      setTouched(true);
      setKept([...keptIds, ...found.map((row) => row.id).filter((id) => !keptIds.includes(id))].slice(0, MAX_KEPT));
      setSearch({ state: 'done', message: found.length ? t(`원문 ${found.length}건을 찾아 근거로 담았습니다.`, `Found and kept ${found.length} quotes.`) : t('웹에서도 맞는 원문을 찾지 못했습니다. 답변만으로 만들면 요구사항은 가설로 표시됩니다.', 'No matching quote on the web either. A PRD from your answers marks requirements as hypotheses.') });
    } catch {
      setSearch({ state: 'error', message: t('연결이 끊겼습니다. 다시 시도해 주세요.', 'Connection lost. Try again.') });
    }
  };

  // A link the person found themselves; the server keeps only sentences that appear in that post word for word.
  const addLink = async (url: string, quote: string) => {
    setSearch({ state: 'busy' });
    try {
      const response = await fetch('/api/opportunities/evidence-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, quote, idea }) });
      const json = await response.json().catch(() => ({}));
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
      setSearch({ state: 'error', message: t('연결이 끊겼습니다. 다시 시도해 주세요.', 'Connection lost. Try again.') });
      return false;
    }
  };

  if (restored && !idea) {
    return <IdeaStart onSubmit={send} en={en} />;
  }

  const chips: Array<[string, string]> = current?.key === 'pain'
    ? matched.map((item) => [item.problem, item.problem] as [string, string])
    : current?.chips ?? [];
  const placeholder = current ? t('직접 적거나 질문 아래에서 고르세요', 'Type, or pick one under the question')
    : generated ? t('고칠 점을 적어 주세요. 예: 타겟을 초보 개발자로 좁혀줘', 'Ask for a change, e.g. narrow it to beginners')
      : t('질문이 끝났습니다. PRD를 만들어 보세요.', 'Questions are done. Make the PRD.');

  // Where the work stands, left to right, so the person always knows the next step.
  const stages: Array<{ label: string; state: 'done' | 'now' | 'todo' }> = [
    { label: t('아이디어', 'Idea'), state: 'done' },
    // No quotes is a fact about the idea, not a step to do now: it never competes with the current question.
    { label: keptQuotes.length ? t(`근거 ${keptQuotes.length}건`, `${keptQuotes.length} quotes`) : t('근거 없음', 'No quotes'), state: keptQuotes.length ? 'done' : 'todo' },
    { label: t(`질문 ${answered}/${QUESTIONS.length}`, `Questions ${answered}/${QUESTIONS.length}`), state: current ? 'now' : 'done' },
    { label: 'PRD', state: generated ? 'done' : current ? 'todo' : 'now' },
    { label: t('에이전트', 'Agent'), state: generated ? 'now' : 'todo' },
  ];
  const picker = <EvidencePicker matched={matched} live={live} saved={saved.filter((row) => !live.some((item) => item.id === row.id))} keptIds={keptIds} toggle={toggle} keptCount={keptQuotes.length} keptPlatforms={keptPlatforms} passes={passes} en={en} search={search} onSearch={() => void searchWeb()} onAddLink={addLink} signedIn={signedIn} loginNext={loginNext} />;
  const threeColumns = !generated;

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="flex min-h-14 items-center gap-4 border-b border-outline-soft bg-white px-4 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold" title={idea}>{idea}</p>
        <ol className="hidden items-center gap-1 md:flex" aria-label={t('진행 단계', 'Progress')}>
          {stages.map((stage, index) => (
            <li key={stage.label} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-outline-strong" />}
              <span aria-current={stage.state === 'now' ? 'step' : undefined} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] ${stage.state === 'now' ? 'bg-seed-soft font-semibold text-seed' : stage.state === 'done' ? 'text-ink' : 'text-muted'}`}>
                {stage.state === 'done' && <Check aria-hidden="true" className="h-3.5 w-3.5 text-seed" strokeWidth={2.5} />}
                {stage.label}
              </span>
            </li>
          ))}
        </ol>
        {/* The model is chosen before anything is written, so it sits in the bar for the whole session. */}
        {signedIn && <div className="hidden shrink-0 sm:block"><ModelPicker models={models} /></div>}
        {/* Phones see one pane at a time, so the make action also sits here, reachable from the chat. */}
        {!generated && (signedIn
          ? <button type="button" className="btn h-10 shrink-0 whitespace-nowrap px-3.5 lg:hidden" onClick={generate} disabled={pending !== null}>{t('PRD 만들기', 'Make PRD')}</button>
          : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-10 shrink-0 whitespace-nowrap px-3.5 lg:hidden">{t('PRD 만들기', 'Make PRD')}</Link>)}
        <button type="button" onClick={reset} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-low hover:text-ink">
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />{t('새로 시작', 'Start over')}
        </button>
      </div>

      <div className="sticky top-16 z-30 flex border-b border-outline-soft bg-white lg:hidden" role="tablist" aria-label={t('보기', 'View')}>
        {([['chat', '대화', 'Chat'], ['doc', '문서', 'Document']] as const).map(([key, ko, enLabel]) => (
          <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)} className="tab flex-1 justify-center">{t(ko, enLabel)}</button>
        ))}
      </div>

      <div className={`min-h-0 flex-1 lg:grid ${threeColumns ? 'lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)_360px]' : 'lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]'}`}>
        <section aria-label={t('기획 대화', 'Planning chat')} className={`${pane === 'chat' ? 'flex' : 'hidden'} h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))] flex-col border-outline-soft bg-white lg:flex lg:h-auto lg:min-h-0 lg:border-r`}>
          <div ref={scroller} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6" aria-live="polite">
            <Bubble role="user">{idea}</Bubble>

            <Bubble role="assistant">
              {/* Picking quotes needs room: below 1280px it happens here, wider screens get it as its own column. */}
              <div className={threeColumns ? 'xl:hidden' : ''}>{picker}</div>
              {threeColumns && (
                <p className="hidden xl:block">
                  {matched.length
                    ? t(`개발자 원문에서 이 아이디어와 맞는 문제 ${matched.length}개를 찾아 원문 ${keptQuotes.length}건을 근거로 담았습니다. 오른쪽에서 빼거나 더할 수 있습니다.`, `Found ${matched.length} developer problems close to this idea and kept ${keptQuotes.length} quotes as evidence. Add or drop them on the right.`)
                    : t('저장된 원문 중 이 아이디어와 맞는 것은 아직 없습니다. 답변만으로도 만들 수 있고, 그때 요구사항은 모두 가설로 표시됩니다.', 'No stored quote matches this idea yet. Your answers alone can still make the PRD, with every requirement marked as a hypothesis.')}
                </p>
              )}
            </Bubble>

            {QUESTIONS.slice(0, step === -1 ? QUESTIONS.length : step + 1).map((question) => (
              <div key={question.key} className="space-y-6">
                <Bubble role="assistant">
                  <p className="font-semibold text-ink">{en ? question.en : question.ko}</p>
                  {(en ? question.hintEn : question.hintKo) && question.key === current?.key && <p className="mt-1 text-[13px] text-muted">{en ? question.hintEn : question.hintKo}</p>}
                  {question.key === current?.key && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {chips.map(([ko, enLabel]) => (
                        <button key={ko} type="button" onClick={() => send(en ? enLabel : ko)} className="min-h-10 max-w-full truncate rounded-full border border-outline-soft bg-white px-3.5 text-left text-[13px] text-tertiary hover:border-outline-strong hover:text-ink">{en ? enLabel : ko}</button>
                      ))}
                      <button type="button" onClick={() => setAnswers((before) => ({ ...before, [question.key]: '' }))} className="min-h-10 rounded-full px-3.5 text-[13px] text-muted hover:text-ink">{t('건너뛰기', 'Skip')}</button>
                    </div>
                  )}
                </Bubble>
                {question.key in answers && (
                  <Bubble role="user" onEdit={() => setAnswers((before) => Object.fromEntries(Object.entries(before).filter(([key]) => QUESTIONS.findIndex((row) => row.key === key) < QUESTIONS.indexOf(question))))} editLabel={t('이 답부터 다시', 'Redo from here')}>
                    {answers[question.key] || <span className="text-muted">{t('건너뜀', 'Skipped')}</span>}
                  </Bubble>
                )}
              </div>
            ))}

            {!current && !generated && (
              <Bubble role="assistant">
                <p>{t('질문이 끝났습니다. 지금 내용으로 PRD 문서를 만들까요? 문서를 먼저 쓰고, 화면 설계와 개발 준비 칸은 문서를 확인한 뒤 버튼 하나로 이어서 만듭니다.', 'That is everything. Write the PRD document now? The document comes first; screens and readiness slots follow with one click once you have checked it.')}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {signedIn && <div className="sm:hidden"><ModelPicker models={models} /></div>}
                  {signedIn
                    ? <button type="button" className="btn h-11 px-5" onClick={generate} disabled={pending === 'generate'}>{pending === 'generate' ? t('PRD 작성 중', 'Writing the PRD') : t('PRD 만들기', 'Make the PRD')}</button>
                    : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-11 px-5">{t('로그인하고 PRD 만들기', 'Sign in to make the PRD')}</Link>}
                </div>
                {!signedIn && <p className="mt-2 text-[13px] text-muted">{t('답변은 이 브라우저에 남아 로그인한 뒤에도 그대로 이어집니다.', 'Your answers stay in this browser and carry over after sign-in.')}</p>}
              </Bubble>
            )}

            {generated && (
              <Bubble role="assistant">
                <p>{t('PRD를 만들었습니다. 오른쪽에서 문서, 기능 명세, 유저플로우, 와이어프레임을 확인하세요. 고칠 점은 여기에 적으면 바로 반영합니다.', 'The PRD is ready. See the document, feature spec, user flow and wireframes on the right. Type a change here and it is applied.')}</p>
              </Bubble>
            )}
            {notes.map((note) => <Bubble key={note.id} role={note.role}>{note.text}</Bubble>)}
            {pending && <p className="text-sm text-muted">{pending === 'generate' ? t('오른쪽에서 PRD를 쓰는 중입니다. 무료 모델은 최대 1분 30초 걸립니다.', 'Writing the PRD on the right. The free model can take up to 90 s.') : t('수정 요청을 반영하는 중입니다.', 'Applying your change.')}</p>}
          </div>

          <div className="border-t border-outline-soft px-4 pb-4 pt-3">
            <form className="flex items-end gap-2 rounded-2xl border border-field bg-white p-2 focus-within:border-ink" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
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

        <section aria-label={t('PRD 문서', 'PRD document')} className={`${pane === 'doc' ? 'block' : 'hidden'} min-w-0 bg-surface-low px-5 pb-28 pt-6 lg:block lg:overflow-y-auto lg:px-8 lg:pb-8`}>
          <PrdBuilder
            title={idea}
            evidenceIds={keptIds}
            ready={passes}
            loginNext={loginNext}
            requestBody={{ brief, evidenceIds: keptIds.filter((id) => !id.startsWith('lv_')), liveEvidence: keptLive, title: idea }}
            models={models}
            hideRevise
            signedIn={signedIn}
            generateSignal={signal}
            externalInstruction={change}
            hideControls={!generated}
            onSpec={() => {
              if (pending === 'revise') say('assistant', t('반영했습니다. 바뀐 곳은 오른쪽 문서와 그래프에서 확인할 수 있습니다.', 'Done. The document and graph on the right show what changed.'));
              setGenerated(true);
              setPending(null);
            }}
            onError={(message) => {
              setPending(null);
              say('assistant', message === 'login' ? t('로그인이 필요합니다. 답변은 그대로 남아 있습니다.', 'Please sign in. Your answers are kept.') : message);
            }}
          >
            {!generated && <LiveDraft idea={idea} answers={answers} current={current?.key ?? null} quotes={keptQuotes} passes={passes} en={en} found={matched[0]?.problem ?? ''} />}
          </PrdBuilder>
          {/* The way out of the questions is always in view: the PRD can be made early, from what is answered so far. */}
          {!generated && (
            <div className="sticky bottom-4 z-10 mx-auto mt-6 mb-2 flex max-w-[46rem] flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-soft bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.08)] lg:bottom-6">
              <p className="text-[14px] text-tertiary">{current ? t(`질문 ${QUESTIONS.length - answered}개가 남았습니다. 지금 만들어도 됩니다.`, `${QUESTIONS.length - answered} questions left. You can make it now.`) : t('질문이 끝났습니다.', 'All questions answered.')}</p>
              {signedIn
                ? <button type="button" className="btn h-11 whitespace-nowrap px-5" onClick={generate} disabled={pending !== null}>{pending === 'generate' ? t('PRD 작성 중', 'Writing the PRD') : t('PRD 만들기', 'Make the PRD')}</button>
                : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-11 whitespace-nowrap px-5">{t('로그인하고 PRD 만들기', 'Sign in to make the PRD')}</Link>}
            </div>
          )}
        </section>

        {threeColumns && (
          <aside aria-label={t('근거 원문 고르기', 'Pick evidence')} className="hidden min-h-0 overflow-y-auto border-l border-outline-soft bg-white px-5 py-6 xl:block">
            {picker}
          </aside>
        )}
      </div>
    </div>
  );
}

/** The quotes found for the idea, to keep or drop, with the evidence bar they add up to. */
function EvidencePicker({ matched, live, saved, keptIds, toggle, keptCount, keptPlatforms, passes, en, search, onSearch, onAddLink, signedIn, loginNext }: { matched: PoolItem[]; live: LiveQuote[]; saved: LiveQuote[]; keptIds: string[]; toggle: (id: string) => void; keptCount: number; keptPlatforms: number; passes: boolean; en: boolean; search: Search; onSearch: () => void; onAddLink: (url: string, quote: string) => Promise<boolean>; signedIn: boolean; loginNext: string }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
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
      <p className="mt-1 text-[13px] leading-5 text-muted">{t('GitHub 이슈, Hacker News, Stack Overflow에서 같은 불편을 말한 글을 찾아, 원문과 글자 단위로 맞는 문장만 가져옵니다. 30초에서 1분 걸립니다.', 'Searches GitHub issues, Hacker News and Stack Overflow for posts about the same problem, keeping only sentences that match the source word for word. Takes 30 to 60 seconds.')}</p>
      <div className="mt-3">
        {signedIn
          ? <button type="button" onClick={onSearch} disabled={search.state === 'busy'} className={`${matched.length || live.length ? 'btn-quiet' : 'btn'} h-10 whitespace-nowrap`}>{search.state === 'busy' ? t('웹에서 찾는 중', 'Searching the web') : live.length ? t('한 번 더 찾기', 'Search again') : t('웹에서 찾기', 'Search the web')}</button>
          : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-10 whitespace-nowrap">{t('로그인하고 웹에서 찾기', 'Sign in to search the web')}</Link>}
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
  if (!matched.length && !live.length && !saved.length) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-ink">{t('저장된 원문 중 맞는 것이 없습니다', 'No stored quote matches yet')}</p>
        <p className="mt-1 text-[14px] leading-6 text-muted">{t('웹에서 찾아보거나, 답변만으로 만들 수 있습니다. 답변만으로 만들면 요구사항은 모두 가설로 표시됩니다.', 'Search the web, or make it from your answers alone; then every requirement is marked as a hypothesis.')}</p>
        {web}
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
    </div>
  );
}

function Bubble({ role, children, onEdit, editLabel }: { role: 'user' | 'assistant'; children: React.ReactNode; onEdit?: () => void; editLabel?: string }) {
  if (role === 'assistant') return <div className="text-[15px] leading-7 text-tertiary">{children}</div>;
  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-surface-mid px-4 py-2.5 text-[15px] leading-6 text-ink [overflow-wrap:anywhere]">{children}</div>
      {onEdit && <button type="button" onClick={onEdit} className="text-xs text-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100">{editLabel}</button>}
    </div>
  );
}

/** The document as the chat fills it, before the model writes the full PRD: nothing here is invented. */
function LiveDraft({ idea, answers, current, quotes, passes, en, found }: { idea: string; answers: Record<string, string>; current: string | null; quotes: PoolItem['quotes']; passes: boolean; en: boolean; found: string }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  const rows: Array<[string, string, string]> = [
    [t('대상 사용자', 'Target users'), 'users', t('누가 가장 먼저 쓰는지', 'Who uses it first')],
    [t('문제', 'Problem'), 'pain', found ? t(`원문이 말하는 문제: ${found}`, `What the quotes describe: ${found}`) : t('그 사람이 가장 불편한 점', 'What hurts them most')],
    [t('지금의 해결 방법', 'How they cope today'), 'now', t('지금은 어떻게 버티는지', 'How they get by today')],
    [t('첫 버전에 꼭 있어야 할 것', 'Must-haves for v1'), 'must', t('첫 버전의 기능 세 가지 이내', 'Up to three things v1 must do')],
    [t('플랫폼', 'Platform'), 'platform', t('웹, 앱, CLI 같은 쓰는 곳', 'Web, app, CLI or wherever it runs')],
    [t('범위 밖', 'Out of scope'), 'out', t('이번 버전에서 하지 않을 것', 'What this version leaves out')],
    [t('추가 의견', 'Other direction'), 'extra', t('방향, 기술 선택, 피하고 싶은 것', 'Direction, tech choices, things to avoid')],
  ];
  return (
    <article className="mx-auto max-w-[46rem] rounded-2xl bg-white px-6 py-8 shadow-[0_0_0_1px_var(--color-outline-soft)] sm:px-10 sm:py-10">
      <p className="text-[13px] text-muted">{t('PRD 초안, 답할 때마다 채워집니다', 'PRD draft, filled in as you answer')}</p>
      <h2 className="mt-2 text-[clamp(22px,2.4vw,30px)] font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{idea}</h2>
      <div className="mt-8 grid gap-6">
        {rows.map(([label, key, hint]) => {
          const value = answers[key];
          const now = key === current;
          return (
            <section key={key} className={now ? '-mx-4 rounded-xl border-l-2 border-seed bg-seed-soft px-4 py-3' : ''}>
              <h3 className="flex items-baseline gap-2 text-[14px] font-semibold">
                {label}
                {now && <span className="text-[12.5px] font-semibold text-seed">{t('지금 질문에서 채웁니다', 'The current question fills this')}</span>}
                {value && key === 'must' && <span className="text-[12.5px] font-normal text-muted">{t('가설, 원문으로 확인 전', 'Hypothesis until quotes back it')}</span>}
              </h3>
              {value === undefined
                ? <p className="mt-1.5 text-[14px] italic leading-7 text-muted/80">{hint}</p>
                : <p className={`mt-1.5 text-[15px] leading-7 ${value ? 'text-ink' : 'text-muted'}`}>{value || t('건너뜀', 'Skipped')}</p>}
            </section>
          );
        })}
        <section>
          <h3 className="text-[14px] font-semibold">{t('근거 원문', 'Evidence')}</h3>
          {quotes.length ? (
            <ol className="mt-3 grid gap-3">
              {quotes.map((row, index) => (
                <li key={row.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 border-l-2 border-seed pl-3 text-sm leading-6">
                  <span className="font-semibold text-seed">E{index + 1}</span>
                  <span className="min-w-0"><q lang="en" className="line-clamp-2">{row.quote}</q><span className="block text-xs text-muted">{PLATFORM_LABELS[row.platform]}</span></span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-1.5 text-[15px] leading-7 text-muted">{t('담은 원문이 없습니다. 모든 요구사항이 가설로 표시됩니다.', 'No quotes kept. Every requirement will be a hypothesis.')}</p>}
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
            {passes && <Check aria-hidden="true" className="h-3.5 w-3.5 text-seed" />}
            {passes ? t('기준을 넘었습니다. 원문이 받쳐 주는 요구사항은 근거로 표시됩니다.', 'Above the bar: requirements the quotes back are marked as evidence.') : t(`기준(원문 ${MIN_EVIDENCE}건, 플랫폼 ${MIN_PLATFORMS}곳) 미만이면 가설 초안으로 만들어집니다.`, `Below the bar (${MIN_EVIDENCE} quotes, ${MIN_PLATFORMS} platforms) it is made as a hypothesis draft.`)}
          </p>
        </section>
      </div>
      <p className="mt-10 border-t border-outline-soft pt-5 text-[13px] leading-6 text-muted">{t('PRD를 만들면 요구사항, 기능, 화면이 이어진 기능 명세 그래프와 유저플로우, 와이어프레임이 함께 생깁니다. 원문이 받쳐 주지 않는 줄은 모두 가설로 남습니다.', 'Making the PRD adds the feature graph (requirement, feature, screen), user flow and wireframes. Lines no quote backs stay hypotheses.')}</p>
    </article>
  );
}

/** The empty state: one question, a few real examples, and what will happen next. */
function IdeaStart({ onSubmit, en }: { onSubmit: (text: string) => void; en: boolean }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  return (
    <div className="page-shell flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center pb-28 text-center">
      <h1 className="t-display text-[clamp(32px,4vw,48px)]">{t('한 줄 아이디어면 PRD가 시작돼요', 'One line of an idea starts the PRD')}</h1>
      <p className="t-lead mt-4 max-w-[36em]">{t('짧은 질문에 답하고 내 의견을 더하면, 실제 개발자 원문을 근거로 PRD·기능 명세·유저플로우·와이어프레임을 만듭니다.', 'Answer a few questions, add your own view, and get a PRD, feature spec, user flow and wireframes grounded in real developer quotes.')}</p>
      <div className="mt-9 w-full max-w-[860px]"><IdeaComposer onSubmit={onSubmit} autoFocus examples={EXAMPLES.map(([ko, enText]) => ({ label: en ? enText : ko, idea: en ? enText : ko }))} /></div>
    </div>
  );
}
