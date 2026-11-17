'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, RotateCcw } from 'lucide-react';
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
type Saved = { idea: string; answers: Record<string, string>; kept: string[]; touched: boolean };
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
    }
    setRestored(true);
  }, [initialIdea]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      if (idea) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, answers, kept: keptIds, touched } satisfies Saved));
    } catch {
      // Private mode or full storage: the chat still works, it just will not survive a reload.
    }
  }, [restored, idea, answers, keptIds, touched]);

  const quoteById = useMemo(() => new Map(pool.flatMap((item) => item.quotes.map((row) => [row.id, row] as const))), [pool]);
  const keptQuotes = keptIds.flatMap((id) => quoteById.get(id) ?? []);
  const keptPlatforms = new Set(keptQuotes.map((row) => row.platform)).size;
  const passes = keptQuotes.length >= MIN_EVIDENCE && keptPlatforms >= MIN_PLATFORMS;

  const step = QUESTIONS.findIndex((question) => !(question.key in answers));
  const current = step === -1 ? null : QUESTIONS[step];
  const answered = QUESTIONS.filter((question) => answers[question.key]).length;
  const completeness = !idea ? 0 : Math.round(10 + (answered / QUESTIONS.length) * 70 + (keptQuotes.length ? 10 : 0) + (passes ? 10 : 0));

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

  if (restored && !idea) {
    return <IdeaStart onSubmit={send} en={en} />;
  }

  const chips: Array<[string, string]> = current?.key === 'pain'
    ? matched.map((item) => [item.problem, item.problem] as [string, string])
    : current?.chips ?? [];
  const placeholder = current ? t('직접 적거나 위에서 고르세요', 'Type, or pick one above')
    : generated ? t('고칠 점을 적어 주세요. 예: 타겟을 초보 개발자로 좁혀줘', 'Ask for a change, e.g. narrow it to beginners')
      : t('질문이 끝났습니다. PRD를 만들어 보세요.', 'Questions are done. Make the PRD.');

  return (
    <div className="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
      <div className="sticky top-16 z-30 flex border-b border-outline-soft bg-white lg:hidden" role="tablist" aria-label={t('보기', 'View')}>
        {([['chat', '대화', 'Chat'], ['doc', '문서', 'Document']] as const).map(([key, ko, enLabel]) => (
          <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)} className="tab flex-1 justify-center">{t(ko, enLabel)}</button>
        ))}
      </div>

      <section aria-label={t('기획 대화', 'Planning chat')} className={`${pane === 'chat' ? 'flex' : 'hidden'} h-[calc(100dvh-11rem)] flex-col border-outline-soft bg-white lg:flex lg:h-auto lg:min-h-0 lg:border-r`}>
        <div className="flex items-center gap-3 border-b border-outline-soft px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold" title={idea}>{idea}</p>
          <button type="button" onClick={reset} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-low hover:text-ink">
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />{t('새로 시작', 'Start over')}
          </button>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6" aria-live="polite">
          <Bubble role="user">{idea}</Bubble>

          <Bubble role="assistant">
            {matched.length ? (
              <>
                <p>{t(`개발자 원문에서 이 아이디어와 맞는 문제 ${matched.length}개를 찾았습니다. 근거로 쓸 원문을 고르세요.`, `Found ${matched.length} developer problems close to this idea. Pick the quotes to use as evidence.`)}</p>
                <div className="mt-3 space-y-4">
                  {matched.map((item) => (
                    <div key={item.slug}>
                      <Link href={`/opportunities/${item.slug}`} target="_blank" className="text-sm font-semibold text-ink underline-offset-4 hover:underline">{item.name}</Link>
                      {item.qualified && <span className="ml-2 text-xs font-medium text-seed">{t('기준 통과', 'Verified')}</span>}
                      <ul className="mt-2 space-y-1.5">
                        {item.quotes.map((row) => {
                          const on = keptIds.includes(row.id);
                          return (
                            <li key={row.id}>
                              <label className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 text-[13.5px] leading-6 transition-colors ${on ? 'border-seed bg-seed-soft' : 'border-outline-soft bg-white hover:border-outline-strong'}`}>
                                <input type="checkbox" checked={on} onChange={() => toggle(row.id)} className="mt-1 h-4 w-4 shrink-0 accent-seed" />
                                <span className="min-w-0">
                                  <q lang="en" className="line-clamp-3 text-ink">{row.quote}</q>
                                  {!en && row.quoteKo && <span className="mt-0.5 line-clamp-2 block text-muted">{row.quoteKo}</span>}
                                  <span className="mt-0.5 block text-xs text-muted">{PLATFORM_LABELS[row.platform]} · <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>{t('원문', 'Source')} ›</a></span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-6 text-muted">
                  {t(`원문 ${keptQuotes.length}건 · 플랫폼 ${keptPlatforms}곳을 담았습니다. `, `${keptQuotes.length} quotes from ${keptPlatforms} platforms kept. `)}
                  {passes
                    ? <span className="font-medium text-seed">{t('기준을 넘어 근거 있는 PRD로 만듭니다.', 'Above the bar: the PRD can cite evidence.')}</span>
                    : t(`기준(원문 ${MIN_EVIDENCE}건·플랫폼 ${MIN_PLATFORMS}곳)에 못 미치면 가설 초안으로 표시됩니다.`, `Below the bar (${MIN_EVIDENCE} quotes, ${MIN_PLATFORMS} platforms) the PRD is marked as a hypothesis draft.`)}
                </p>
              </>
            ) : (
              <p>{t('아직 이 아이디어와 맞는 개발자 원문을 찾지 못했습니다. 답변만으로도 PRD를 만들 수 있지만, 모든 줄이 원문 없는 가설로 표시됩니다.', 'No developer quote matches this idea yet. You can still make a PRD from your answers, but every line will be marked as a hypothesis.')}</p>
            )}
          </Bubble>

          {QUESTIONS.slice(0, step === -1 ? QUESTIONS.length : step + 1).map((question) => (
            <div key={question.key} className="space-y-6">
              <Bubble role="assistant">
                <p className="font-medium text-ink">{en ? question.en : question.ko}</p>
                {(en ? question.hintEn : question.hintKo) && question.key === current?.key && <p className="mt-1 text-[13px] text-muted">{en ? question.hintEn : question.hintKo}</p>}
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
              <p>{t('질문이 끝났습니다. 지금 내용으로 PRD를 만들까요? 요구사항, 기능 명세, 유저플로우, 와이어프레임이 함께 만들어집니다.', 'That is everything. Make the PRD now? Requirements, feature spec, user flow and wireframes come together.')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {signedIn && <ModelPicker models={models} />}
                {signedIn
                  ? <button type="button" className="btn h-11 px-5" onClick={generate} disabled={pending === 'generate'}>{pending === 'generate' ? t('PRD 작성 중, 최대 1분 30초', 'Writing, up to 90 s') : t('PRD 만들기', 'Make the PRD')}</button>
                  : <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="btn h-11 px-5">{t('로그인하고 PRD 만들기', 'Sign in to make the PRD')}</Link>}
              </div>
              {!signedIn && <p className="mt-2 text-[13px] text-muted">{t('답변은 이 브라우저에 남아 로그인한 뒤에도 그대로 이어집니다.', 'Your answers stay in this browser and carry over after sign-in.')}</p>}
            </Bubble>
          )}

          {generated && (
            <Bubble role="assistant">
              <p>{t('PRD를 만들었습니다. 오른쪽에서 기능 명세 그래프, 유저플로우, 와이어프레임을 확인하세요. 고칠 점은 여기에 적으면 바로 반영합니다.', 'The PRD is ready. See the feature graph, user flow and wireframes on the right. Type a change here and it is applied.')}</p>
            </Bubble>
          )}
          {notes.map((note) => <Bubble key={note.id} role={note.role}>{note.text}</Bubble>)}
          {pending && <p className="text-sm text-muted">{pending === 'generate' ? t('오른쪽에서 PRD를 쓰는 중입니다. 무료 모델이라 최대 1분 30초 걸립니다.', 'Writing the PRD on the right. The free model can take up to 90 s.') : t('수정 요청을 반영하는 중입니다.', 'Applying your change.')}</p>}
        </div>

        <div className="border-t border-outline-soft px-4 pb-4 pt-3">
          {current && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {chips.map(([ko, enLabel]) => (
                <button key={ko} type="button" onClick={() => send(en ? enLabel : ko)} className="max-w-full truncate rounded-lg border border-outline-soft bg-white px-3 py-1.5 text-left text-[13px] text-tertiary hover:border-outline-strong hover:text-ink">{en ? enLabel : ko}</button>
              ))}
              <button type="button" onClick={() => setAnswers((before) => ({ ...before, [current.key]: '' }))} className="rounded-lg px-3 py-1.5 text-[13px] text-muted hover:text-ink">{t('건너뛰기', 'Skip')}</button>
            </div>
          )}
          <form className="flex items-end gap-2 rounded-2xl border border-outline-strong bg-white p-2 focus-within:border-ink" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <label htmlFor="idea-composer" className="sr-only">{t('답변 입력', 'Your answer')}</label>
            <textarea
              id="idea-composer"
              rows={2}
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
              className="min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted disabled:cursor-not-allowed"
            />
            <button type="submit" aria-label={t('보내기', 'Send')} disabled={!draft.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:bg-surface-high disabled:text-muted">
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      <section aria-label={t('PRD 문서', 'PRD document')} className={`${pane === 'doc' ? 'block' : 'hidden'} min-w-0 bg-surface-low px-5 pb-28 pt-6 lg:block lg:overflow-y-auto lg:px-8 lg:pb-16`}>
        {!generated && (
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm text-muted">{t('완성도', 'Completeness')}</span>
            <span aria-hidden="true" className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-high"><span className="block h-full rounded-full bg-seed transition-[width] duration-500" style={{ width: `${completeness}%` }} /></span>
            <span className="num text-sm font-semibold" aria-label={t(`완성도 ${completeness}%`, `${completeness}% complete`)}>{completeness}%</span>
          </div>
        )}
        <PrdBuilder
          title={idea}
          evidenceIds={keptIds}
          ready={passes}
          loginNext={loginNext}
          requestBody={{ brief, evidenceIds: keptIds, title: idea }}
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
          {!generated && <LiveDraft idea={idea} answers={answers} quotes={keptQuotes} passes={passes} en={en} />}
        </PrdBuilder>
      </section>
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
function LiveDraft({ idea, answers, quotes, passes, en }: { idea: string; answers: Record<string, string>; quotes: PoolItem['quotes']; passes: boolean; en: boolean }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  const rows: Array<[string, string | undefined, string]> = [
    [t('대상 사용자', 'Target users'), answers.users, 'users'],
    [t('문제', 'Problem'), answers.pain, 'pain'],
    [t('지금의 해결 방법', 'How they cope today'), answers.now, 'now'],
    [t('첫 버전에 꼭 있어야 할 것', 'Must-haves for v1'), answers.must, 'must'],
    [t('플랫폼', 'Platform'), answers.platform, 'platform'],
    [t('범위 밖', 'Out of scope'), answers.out, 'out'],
    [t('추가 의견', 'Other direction'), answers.extra, 'extra'],
  ];
  return (
    <article className="mt-2 rounded-2xl bg-white p-6 shadow-[0_0_0_1px_var(--color-outline-soft)] sm:p-9">
      <p className="text-[13px] text-muted">{t('PRD 초안 · 대화에서 채워지는 중', 'PRD draft · filling from the chat')}</p>
      <h2 className="mt-2 text-[clamp(22px,2.4vw,28px)] font-bold leading-tight tracking-tight">{idea}</h2>
      <dl className="mt-8 grid gap-7">
        {rows.map(([label, value, key]) => (
          <div key={key} className="grid gap-1.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
            <dt className="text-sm font-semibold">{label}</dt>
            <dd className={`text-[15px] leading-7 ${value ? 'text-ink' : 'text-muted'}`}>
              {value === undefined ? t('대화에서 채워집니다', 'Filled in from the chat') : value || t('건너뜀', 'Skipped')}
              {value && key === 'must' && <span className="ml-2 text-[13px] text-muted">{t('가설 · 원문으로 확인 전', 'hypothesis · not yet backed by quotes')}</span>}
            </dd>
          </div>
        ))}
        <div className="grid gap-1.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold">{t('근거 원문', 'Evidence')}</dt>
          <dd className="min-w-0">
            {quotes.length ? (
              <ol className="grid gap-3">
                {quotes.map((row, index) => (
                  <li key={row.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 border-l-2 border-seed pl-3 text-sm leading-6">
                    <span className="font-semibold text-seed">{index + 1}</span>
                    <span className="min-w-0"><q lang="en" className="line-clamp-2">{row.quote}</q><span className="block text-xs text-muted">{PLATFORM_LABELS[row.platform]} · {t('원문과 일치', 'verbatim')}</span></span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-[15px] leading-7 text-muted">{t('담은 원문이 없습니다. 모든 요구사항이 가설로 표시됩니다.', 'No quotes kept. Every requirement will be a hypothesis.')}</p>}
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
              {passes && <Check aria-hidden="true" className="h-3.5 w-3.5 text-seed" />}
              {passes ? t('기준 통과: 원문이 받쳐 주는 요구사항은 근거로 표시됩니다.', 'Above the bar: requirements the quotes back are marked as evidence.') : t(`기준(원문 ${MIN_EVIDENCE}건·플랫폼 ${MIN_PLATFORMS}곳) 미만: 가설 초안으로 만들어집니다.`, `Below the bar (${MIN_EVIDENCE} quotes, ${MIN_PLATFORMS} platforms): made as a hypothesis draft.`)}
            </p>
          </dd>
        </div>
      </dl>
      <p className="mt-10 border-t border-outline-soft pt-5 text-[13px] leading-6 text-muted">{t('PRD를 만들면 요구사항 → 기능 → 화면이 이어진 기능 명세 그래프, 유저플로우, 와이어프레임이 함께 생깁니다. 원문이 받쳐 주지 않는 줄은 모두 가설로 남습니다.', 'Making the PRD adds the feature graph (requirement → feature → screen), user flow and wireframes. Lines no quote backs stay hypotheses.')}</p>
    </article>
  );
}

/** The empty state: one question, a few real examples, and what will happen next. */
function IdeaStart({ onSubmit, en }: { onSubmit: (text: string) => void; en: boolean }) {
  const t = (ko: string, enText: string) => (en ? enText : ko);
  const [text, setText] = useState('');
  return (
    <div className="page-shell flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center pb-28 text-center">
      <h1 className="text-[clamp(30px,4.6vw,52px)] font-bold leading-[1.15] tracking-[-0.04em] [text-wrap:balance]">{t('무엇을 만들고 싶나요?', 'What do you want to build?')}</h1>
      <p className="mt-4 max-w-[34em] text-[17px] leading-8 text-tertiary">{t('짧은 질문에 답하고 내 의견을 더하면, 실제 개발자 원문을 근거로 PRD·기능 명세·유저플로우·와이어프레임을 만듭니다.', 'Answer a few questions, add your own view, and get a PRD, feature spec, user flow and wireframes grounded in real developer quotes.')}</p>
      <form className="mt-9 w-full max-w-[680px] rounded-2xl border border-outline-strong bg-white p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.06)] focus-within:border-ink" onSubmit={(event) => { event.preventDefault(); onSubmit(text); }}>
        <label htmlFor="idea-start" className="sr-only">{t('만들고 싶은 것', 'What you want to build')}</label>
        <textarea
          id="idea-start"
          rows={3}
          value={text}
          maxLength={300}
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit(text);
            }
          }}
          placeholder={t('예: 여러 LLM 제공사를 코드 수정 없이 바꿔 쓰는 개발 도구', 'e.g. A dev tool to switch LLM providers without code changes')}
          className="block w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[17px] leading-7 outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="num pl-2 text-[13px] text-muted">{text.length}/300</span>
          <button type="submit" disabled={text.trim().length < 4} className="btn h-10">{t('시작하기', 'Start')}</button>
        </div>
      </form>
      <div className="mt-6 flex max-w-[680px] flex-wrap justify-center gap-2">
        {EXAMPLES.map(([ko, enText]) => (
          <button key={ko} type="button" onClick={() => onSubmit(en ? enText : ko)} className="rounded-lg border border-outline-soft bg-white px-3.5 py-2 text-sm text-tertiary hover:border-outline-strong hover:text-ink">{en ? enText : ko}</button>
        ))}
      </div>
      <Link href="/prd#verified" className="link-seed mt-8">{t('기준을 통과한 문제로 바로 시작하기', 'Start from a problem that passed the bar')} ›</Link>
    </div>
  );
}
