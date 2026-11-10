'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { StageNews, StageOpportunity, StageQuote } from '@/lib/opportunities/data';
import { matchOpportunities, quoteMentions } from '@/lib/opportunities/match';
import { MIN_EVIDENCE, MIN_PLATFORMS } from '@/lib/opportunities/types';
import type { ChipPile } from './chip-pile';
import EvidenceCertificate from './EvidenceCertificate';
import styles from './stage.module.css';

export type StageChip = StageQuote & { slug: string; bg: string; fg: string };

const STORAGE_KEY = 'seedup:stage';
const SEMANTIC_DEBOUNCE_MS = 450;

function roundRobin(opportunities: StageOpportunity[]) {
  const pools = opportunities.map((item) => item.quotes.map((quote): StageChip => ({ ...quote, slug: item.slug, bg: item.bg, fg: item.fg })));
  const out: StageChip[] = [];
  while (pools.some((pool) => pool.length)) {
    for (const pool of pools) {
      const next = pool.shift();
      if (next) out.push(next);
    }
  }
  return out;
}

function readStored(): { query: string; kept: string[] } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function OpportunityStage({ opportunities, news, header }: {
  opportunities: StageOpportunity[];
  news: StageNews[];
  header: ReactNode;
}) {
  const chips = useMemo(() => roundRobin(opportunities), [opportunities]);
  const chipById = useMemo(() => new Map(chips.map((chip) => [chip.id, chip])), [chips]);
  const suggestions = useMemo(() => opportunities.slice(0, 4).map((item) => item.name), [opportunities]);

  const [query, setQuery] = useState('');
  const [semantic, setSemantic] = useState<{ query: string; slugs: string[] } | null>(null);
  const [keptIds, setKeptIds] = useState<string[]>([]);
  const [folderHot, setFolderHot] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const stageRef = useRef<HTMLElement>(null);
  const folderRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<ChipPile | null>(null);
  const typingTimerRef = useRef(0);
  const previousKeptRef = useRef(0);

  const match = useMemo(() => {
    const keyword = matchOpportunities(query, opportunities);
    if (!keyword.active) return { active: false, chips: [] as StageChip[], top: null as StageOpportunity | null };
    const semanticSlugs = semantic?.query === query.trim() ? semantic.slugs : [];
    const ranked = [...new Set([...semanticSlugs, ...keyword.slugs])];
    const wanted = new Set(ranked);
    const matched = chips.filter((chip) => wanted.has(chip.slug) || quoteMentions(keyword.tokens, `${chip.quote} ${chip.quoteKo}`));
    const topSlug = ranked[0] ?? matched[0]?.slug;
    return { active: true, chips: matched, top: opportunities.find((item) => item.slug === topSlug) ?? null };
  }, [query, semantic, chips, opportunities]);

  const remaining = match.chips.filter((chip) => !keptIds.includes(chip.id));
  const typed = query.trim();

  // Semantic matching upgrades the instant keyword result. If it fails, keywords remain.
  useEffect(() => {
    if (typed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/opportunities/match?q=${encodeURIComponent(typed)}`, { signal: controller.signal });
        const json = (await response.json()) as { slugs?: string[] | null };
        if (Array.isArray(json.slugs)) setSemantic({ query: typed, slugs: json.slugs });
      } catch {
        // Aborted or offline; the keyword result stays on screen.
      }
    }, SEMANTIC_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed]);

  useEffect(() => {
    let cancelled = false;
    const stage = stageRef.current;
    const folder = folderRef.current;
    if (!stage || !folder) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stored = readStored();
    const initialKept = (stored?.kept ?? []).filter((id) => chipById.has(id));

    (async () => {
      const [{ default: Matter }, { ChipPile: Pile }] = await Promise.all([import('matter-js'), import('./chip-pile')]);
      await Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((resolve) => setTimeout(resolve, 1_500))]);
      if (cancelled) return;
      const elements = [...stage.querySelectorAll<HTMLElement>('[data-chip]')];
      const pile = new Pile({
        Matter,
        stage,
        folder,
        ceiling: askRef.current ?? stage,
        chips: elements.map((el) => ({ id: el.dataset.chip as string, el })),
        initialKept: new Set(initialKept),
        reduced,
        leavingClass: styles.chipLeaving,
        draggingClass: styles.chipDragging,
        onCollected: (id) => setKeptIds((current) => (current.includes(id) ? current : [...current, id])),
        onFolderHot: setFolderHot,
      });
      pile.start();
      pileRef.current = pile;
      previousKeptRef.current = initialKept.length;
      setKeptIds(initialKept);
      if (stored?.query) setQuery(stored.query);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      pileRef.current?.destroy();
      pileRef.current = null;
    };
  }, [chipById]);

  useEffect(() => {
    pileRef.current?.apply(match.active && match.chips.length ? match.chips.map((chip) => chip.id) : null);
  }, [match, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query, kept: keptIds }));
    } catch {
      // Private browsing can refuse storage; only the restore after login is lost.
    }
  }, [query, keptIds, ready]);

  useEffect(() => {
    const grew = keptIds.length > previousKeptRef.current;
    previousKeptRef.current = keptIds.length;
    if (!grew || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    folderRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.07,.95)' }, { transform: 'scale(.98,1.03)' }, { transform: 'scale(1)' }],
      { duration: 340, easing: 'ease-out' },
    );
  }, [keptIds]);

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  const typeIn = (text: string) => {
    clearTimeout(typingTimerRef.current);
    inputRef.current?.focus({ preventScroll: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setQuery(text);
      return;
    }
    setQuery('');
    let index = 0;
    const step = () => {
      index += 1;
      setQuery(text.slice(0, index));
      if (index < text.length) typingTimerRef.current = window.setTimeout(step, 55);
    };
    typingTimerRef.current = window.setTimeout(step, 120);
  };

  const closeCertificate = useCallback(() => {
    setCertificateOpen(false);
    folderRef.current?.focus({ preventScroll: true });
  }, []);

  const removeKept = useCallback((id: string) => {
    setKeptIds((current) => current.filter((item) => item !== id));
    pileRef.current?.release(id);
  }, []);

  const kept = keptIds.flatMap((id) => chipById.get(id) ?? []);
  const platformCount = new Set(kept.map((chip) => chip.platform)).size;
  const passed = kept.length >= MIN_EVIDENCE && platformCount >= MIN_PLATFORMS;
  const shortfall = MIN_EVIDENCE - kept.length;
  const counts = new Map<string, number>();
  for (const chip of kept) counts.set(chip.slug, (counts.get(chip.slug) ?? 0) + 1);
  const leadSlug = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const lead = opportunities.find((item) => item.slug === leadSlug) ?? null;
  const risePercent = Math.min(1, kept.length / MIN_EVIDENCE);
  const hasMatches = match.active && match.chips.length > 0;

  const matchedSlugs = new Set(match.chips.map((chip) => chip.slug));
  const relatedTo = (item: StageNews) => opportunities.find((opportunity) => matchedSlugs.has(opportunity.slug) && opportunity.keywords.some((word) => word.length >= 2 && item.terms.some((term) => term.includes(word))));
  const orderedNews = hasMatches ? [...news].sort((a, b) => Number(Boolean(relatedTo(b))) - Number(Boolean(relatedTo(a)))) : news;

  return (
    <>
      <section className={`${styles.stage} ${ready ? styles.ready : ''}`} ref={stageRef} aria-label="아이디어로 현장 증언 찾기">
        {header}
        <div className={styles.ask} id="main-content" ref={askRef}>
          <h1 className="sr-only">만들고 싶은 것을 입력하면 실제 개발자의 증언이 반응합니다</h1>
          <label className="sr-only" htmlFor="stage-query">무엇을 만들고 싶나요?</label>
          <div className={styles.inputWrap}>
            <input
              ref={inputRef}
              id="stage-query"
              className={styles.input}
              type="text"
              name="idea"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={120}
              placeholder="무엇을 만들고 싶나요?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className={styles.readout} aria-live="polite">
            {!match.active && <>개발자들이 실제로 한 말 <b>{chips.length}개</b>가 쌓여 있습니다. 만들고 싶은 것을 입력해 보세요.</>}
            {match.active && !hasMatches && '아직 이 주제의 증언이 없습니다. 다른 표현으로 입력해 보세요.'}
            {hasMatches && <>증언 <b>{match.chips.length}개</b> · 플랫폼 <b>{new Set(match.chips.map((chip) => chip.platform)).size}종</b> · 직접 경쟁 <b>{match.top?.directCount ?? 0}개</b></>}
          </p>
          <div className={styles.tools}>
            {remaining.length > 0 && (
              <button type="button" className={`${styles.pill} ${styles.collect}`} onClick={() => pileRef.current?.collectMany(remaining.map((chip) => chip.id))}>
                반응한 증언 {remaining.length}개 모두 담기
              </button>
            )}
            {!typed && suggestions.map((text) => (
              <button key={text} type="button" className={styles.pill} onClick={() => typeIn(text)}>{text}</button>
            ))}
            {typed && !hasMatches && (
              <button type="button" className={styles.pill} onClick={() => { setQuery(''); inputRef.current?.focus(); }}>지우기</button>
            )}
          </div>
          {hasMatches && <p className={styles.hint}>증언을 끌어서 폴더에 넣거나, 눌러서 담을 수 있습니다.</p>}
        </div>

        {chips.map((chip) => (
          <button key={chip.id} type="button" className={styles.chip} data-chip={chip.id} lang={chip.quoteKo ? undefined : 'en'} title={chip.quoteKo ? `${chip.quoteKo}\n원문: ${chip.quote}` : undefined} aria-label={`${chip.quoteKo || chip.quote}. 근거로 담기`}>
            <span className={styles.chipBody} style={{ '--chip-bg': chip.bg, '--chip-fg': chip.fg } as CSSProperties}>{chip.quoteKo || chip.quote}</span>
          </button>
        ))}

        <button
          ref={folderRef}
          type="button"
          className={`${styles.folder} ${passed ? styles.folderPass : ''} ${folderHot ? styles.folderHot : ''}`}
          aria-label={`담은 근거 ${kept.length}건으로 확인서 열기`}
          onClick={() => setCertificateOpen(true)}
        >
          <span className={styles.folderBack} />
          <span className={styles.folderPaper} style={{ '--rise': `calc(var(--rise-low, 44px) + (var(--rise-high, -56px) - var(--rise-low, 44px)) * ${risePercent})` } as CSSProperties}>
            <strong>근거 확인서</strong><i /><i />
            <span className={styles.stamp}>통과</span>
          </span>
          <span className={styles.folderFront}>
            <span className={styles.folderCount}><b>{kept.length}</b>담은 근거</span>
            <span className={styles.folderSub}>
              <span>플랫폼 {platformCount}/{MIN_PLATFORMS}</span>
              <b>{passed ? '기준 통과' : shortfall > 0 ? `${shortfall}건 더 필요` : '플랫폼 부족'}</b>
            </span>
          </span>
        </button>
      </section>

      {orderedNews.length > 0 && (
        <section className={styles.read} aria-labelledby="today-heading">
          <h2 id="today-heading">오늘 읽을 것</h2>
          <p className={styles.readLead}>{hasMatches ? '입력한 주제와 이어지는 글이 앞에 나옵니다.' : '주제를 입력하면 이어지는 글이 앞으로 옵니다.'}</p>
          {orderedNews.map((item) => {
            const related = hasMatches ? relatedTo(item) : undefined;
            return (
              <Link key={item.id} href={`/news/${item.id}`} className={`${styles.news} ${hasMatches && !related ? styles.newsDim : ''}`}>
                <strong>{item.title}</strong>
                <span className={styles.newsMeta}>
                  {related && <i style={{ '--dot': related.bg } as CSSProperties} aria-hidden="true" />}
                  {related?.name ?? item.source}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {certificateOpen && (
        <EvidenceCertificate
          chips={kept}
          typed={typed}
          leadName={lead?.name ?? null}
          gap={lead?.gap ?? ''}
          directCount={lead?.directCount ?? null}
          platformCount={platformCount}
          passed={passed}
          verdict={passed ? '기준 통과' : shortfall > 0 ? `근거 ${shortfall}건이 더 필요합니다` : '플랫폼이 더 필요합니다'}
          onClose={closeCertificate}
          onRemove={removeKept}
        />
      )}
    </>
  );
}
