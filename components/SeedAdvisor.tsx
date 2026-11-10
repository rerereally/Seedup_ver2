'use client';

import Link from 'next/link';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { SeedIdea, SeedLink, SeedOpportunityRef, SeedPaper } from '@/lib/seeds/advise';

type RepoCard = {
  name: string;
  url: string;
  description: string;
  language: string;
  topics: string[];
  stars: number;
  pushedAt: string | null;
  near: SeedOpportunityRef[];
  news: SeedLink[];
  similar: SeedLink[];
};


const STORAGE_KEY = 'seedup:seeds-login';
const STATUS_LABELS: Record<SeedOpportunityRef['status'], string> = { open: '열림', narrowing: '좁아지는 중', closed: '이미 많음', unknown: '확인 전' };

const formatDate = (value: string | null) => (value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value)) : '');

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-outline-soft px-5 py-5 sm:px-6">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-extrabold text-ink">{title}{note && <span className="text-[13px] font-normal text-muted">{note}</span>}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function OpportunityLine({ item }: { item: SeedOpportunityRef }) {
  return (
    <Link href={`/opportunities/${item.slug}`} className="mt-2 block rounded-xl border border-outline-soft px-3.5 py-3 transition-colors hover:border-outline-strong">
      <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
        <b className="font-bold text-ink">{item.name}</b>
        <span>{STATUS_LABELS[item.status]}</span>
        <span>증언 <span className="num">{item.evidenceCount}</span>건</span>
      </span>
      {item.quote && <span className="mt-1 block text-sm leading-6 text-muted">“{item.quote}”</span>}
    </Link>
  );
}

function LinkList({ items }: { items: SeedLink[] }) {
  return (
    <ul className="grid gap-1">
      {items.map((item) => (
        <li key={item.href}>
          {item.external ? (
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-baseline justify-between gap-4 rounded-lg py-1.5 hover:underline">
              <span className="min-w-0 text-sm leading-6 text-ink">{item.title} <ArrowUpRight aria-hidden="true" className="inline h-3.5 w-3.5 text-muted" /></span>
              <span className="shrink-0 text-[13px] text-muted">{item.meta}</span>
            </a>
          ) : (
            <Link href={item.href} className="flex items-baseline justify-between gap-4 rounded-lg py-1.5 hover:underline">
              <span className="min-w-0 text-sm leading-6 text-ink">{item.title}</span>
              <span className="num shrink-0 text-[13px] text-muted">{item.meta}</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function SeedAdvisor() {
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ login: string; repos: RepoCard[] } | null>(null);
  const [ideas, setIdeas] = useState<Record<string, SeedIdea>>({});
  // A repo is listed here until its suggestion arrives or the model gives up on it.
  const [pending, setPending] = useState<string[]>([]);
  const [missed, setMissed] = useState(0);
  const [papers, setPapers] = useState<Record<string, SeedPaper[]>>({});
  const runRef = useRef(0);

  const look = async (raw: string) => {
    const name = raw.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').split('/')[0];
    if (!name || loading) return;
    const run = (runRef.current += 1);
    const current = () => run === runRef.current;
    setLoading(true);
    setError('');
    setResult(null);
    setIdeas({});
    setPapers({});
    setPending([]);
    setMissed(0);

    let repos: RepoCard[] = [];
    try {
      const response = await fetch(`/api/seeds?user=${encodeURIComponent(name)}`);
      const json = (await response.json()) as { login?: string; repos?: RepoCard[]; error?: string };
      if (!current()) return;
      if (!response.ok || !json.repos) throw new Error(json.error ?? '레포를 읽지 못했습니다.');
      repos = json.repos;
      setResult({ login: json.login ?? name, repos });
      try {
        localStorage.setItem(STORAGE_KEY, name);
      } catch {
        // Storage can be blocked; the name is then simply not remembered.
      }
    } catch (reason) {
      if (current()) setError(reason instanceof Error ? reason.message : '레포를 읽지 못했습니다.');
      return;
    } finally {
      if (current()) setLoading(false);
    }
    if (!repos.length) return;

    setPending(repos.map((repo) => repo.name));
    for (const repo of repos) {
      let idea: SeedIdea | null = null;
      try {
        const response = await fetch(`/api/seeds?step=ideas&user=${encodeURIComponent(name)}&repo=${encodeURIComponent(repo.name)}`);
        idea = ((await response.json()) as { idea?: SeedIdea | null }).idea ?? null;
      } catch {
        // The keyword matches already on screen stay; only this suggestion is missing.
      }
      if (!current()) return;
      if (idea) setIdeas((before) => ({ ...before, [repo.name]: idea }));
      else setMissed((count) => count + 1);
      setPending((before) => before.filter((item) => item !== repo.name));

      // Without a suggestion, the repo's own topics are the only honest search terms.
      const query = idea ? idea.paperQuery : repo.topics.slice(0, 3).join(' ').replace(/-/g, ' ');
      if (!query) continue;
      try {
        const response = await fetch(`/api/seeds?step=papers&q=${encodeURIComponent(query)}`);
        const json = (await response.json()) as { papers?: SeedPaper[] };
        if (!current()) return;
        if (json.papers?.length) setPapers((before) => ({ ...before, [repo.name]: json.papers as SeedPaper[] }));
      } catch {
        // One failed search should not stop the others.
      }
      // arXiv asks clients to leave about three seconds between requests; the next model call takes longer than that.
    }
  };

  const restore = useEffectEvent((saved: string) => {
    setLogin(saved);
    void look(saved);
  });
  useEffect(() => {
    let saved = '';
    try {
      saved = localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      // Storage is blocked; the visitor types the name again.
    }
    if (!saved) return;
    // Deferred so the first paint matches the server, then the remembered name is looked up again.
    const timer = window.setTimeout(() => restore(saved), 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void look(login);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="card p-5 sm:p-6">
        <label htmlFor="seed-login" className="text-[15px] font-extrabold text-ink">GitHub 아이디</label>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            id="seed-login"
            name="github-login"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={80}
            placeholder="예: torvalds"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            className="h-11 min-w-0 flex-1 basis-56 rounded-full border border-outline-soft bg-transparent px-4 text-ink placeholder:text-muted focus:border-outline-strong focus:outline-none"
          />
          <button type="submit" disabled={loading || !login.trim()} className="btn h-11 disabled:cursor-not-allowed disabled:opacity-50">
            {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {loading ? '읽는 중' : '레포 살펴보기'}
          </button>
        </div>
        <p className="mt-3 text-[13px] leading-6 text-muted">공개 레포 가운데 최근에 작업한 5개만 읽습니다. 로그인은 필요 없고, 비공개 레포는 읽지 않습니다.</p>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-hot">{error}</p>}
      </form>

      {result && result.repos.length === 0 && (
        <div className="empty-state">
          <h2 className="text-xl font-extrabold text-ink">읽을 공개 레포가 없습니다</h2>
          <p className="mx-auto mt-2 max-w-[32em] leading-7 text-muted">포크와 보관 처리된 레포는 빼고 봅니다. 먼저 만들 것을 찾는다면 기회 목록에서 시작해 보세요.</p>
          <Link href="/opportunities" className="btn mt-6">기회 살펴보기</Link>
        </div>
      )}

      {result && result.repos.length > 0 && (
        <p aria-live="polite" className="text-sm text-muted">
          {pending.length > 0 && <><Loader2 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />레포를 하나씩 읽고 더할 기능을 생각하는 중입니다. 남은 레포 <span className="num">{pending.length}</span>개, 무료 모델이라 레포마다 1분쯤 걸릴 수 있습니다.</>}
          {pending.length === 0 && missed > 0 && `AI 모델이 답하지 않아 레포 ${missed}개는 기능 제안을 만들지 못했습니다. 그 레포에는 키워드와 의미로 맞춘 결과만 보입니다.`}
          {pending.length === 0 && missed === 0 && '기능 제안은 무료 AI 모델이 레포 설명과 README만 읽고 쓴 것이라 틀릴 수 있습니다.'}
        </p>
      )}

      {result?.repos.map((repo) => {
        const idea = ideas[repo.name];
        const repoPapers = papers[repo.name];
        const waiting = pending.includes(repo.name);
        const cited = new Set(idea?.features.flatMap((feature) => feature.opportunity?.slug ?? []));
        const near = repo.near.filter((item) => !cited.has(item.slug));
        const empty = !idea?.features.length && !near.length && !repo.news.length && !repo.similar.length && !repoPapers?.length && !waiting;
        return (
          <article key={repo.name} className="card overflow-hidden">
            <header className="px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">
                  <a href={repo.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{repo.name}</a>
                </h2>
                <p className="text-[13px] text-muted">
                  {[repo.language, repo.stars ? `★ ${repo.stars.toLocaleString('en-US')}` : '', repo.pushedAt ? `${formatDate(repo.pushedAt)} 작업` : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="mt-2 leading-7 text-muted">{idea?.summary || repo.description || '설명이 없는 레포입니다.'}</p>
            </header>

            {(idea?.features.length ?? 0) > 0 && (
              <Section title="더하면 좋을 기능">
                <ol className="grid gap-4">
                  {idea!.features.map((feature) => (
                    <li key={feature.title}>
                      <p className="font-bold text-ink">{feature.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{feature.why}</p>
                      {feature.opportunity && <OpportunityLine item={feature.opportunity} />}
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {near.length > 0 && (
              <Section title="가까운 개발자 불만" note="이 레포가 다루는 주제에서 사람들이 실제로 한 말입니다">
                {near.map((item) => <OpportunityLine key={item.slug} item={item} />)}
              </Section>
            )}

            {repo.news.length > 0 && <Section title="참고할 소식"><LinkList items={repo.news} /></Section>}

            {repoPapers && repoPapers.length > 0 && (
              <Section title="읽어볼 논문" note="검색어로 찾은 결과라 관련이 약할 수 있습니다">
                <ul className="grid gap-3">
                  {repoPapers.map((paper) => (
                    <li key={paper.url}>
                      <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold leading-6 text-ink hover:underline">
                        {paper.title} <ArrowUpRight aria-hidden="true" className="inline h-3.5 w-3.5 text-muted" />
                      </a>
                      <p lang="en" className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted">{[paper.year, paper.summary].filter(Boolean).join(' · ')}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {repo.similar.length > 0 && <Section title="비슷한 오픈소스"><LinkList items={repo.similar} /></Section>}

            {waiting && (
              <p className="border-t border-outline-soft px-5 py-4 text-sm text-muted sm:px-6">
                <Loader2 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />{pending[0] === repo.name ? '더할 기능을 생각하는 중' : '차례를 기다리는 중'}
              </p>
            )}

            {empty && (
              <p className="border-t border-outline-soft px-5 py-5 text-sm leading-6 text-muted sm:px-6">
                이 레포와 이어지는 증언이나 소식을 찾지 못했습니다. 설명과 토픽을 채우면 더 잘 맞출 수 있습니다.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
