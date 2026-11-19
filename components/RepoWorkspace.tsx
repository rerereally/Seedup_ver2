'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import ModelPicker from '@/components/ModelPicker';
import SeedAdvisor from '@/components/SeedAdvisor';
import type { PrdModel } from '@/lib/opportunities/models';
import type { SeedStatus } from '@/components/SeedAdvisor';
import WorkSplit, { Bubble, ChatInput, showInResult } from '@/components/WorkSplit';
import type { Stage } from '@/components/WorkSplit';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));

/**
 * Repo analysis in the /prd work frame: the account, how the reading goes and the list of repos on the left; the
 * repo picked there on the right, one at a time.
 */
export default function RepoWorkspace({ initialLogin, initialRepo, userId, lang, signedIn, models = [] }: { initialLogin: string; initialRepo: string | null; userId?: string; lang: Lang; signedIn: boolean; models?: PrdModel[] }) {
  const [run, setRun] = useState(initialLogin ? { login: initialLogin, id: 1 } : null);
  const [status, setStatus] = useState<SeedStatus | null>(null);
  const [picked, setPicked] = useState(initialRepo);
  const t = translator(lang);
  const here = (login: string) => `/prd/repo?user=${encodeURIComponent(login)}`;

  const ask = (login: string) => {
    setRun((before) => ({ login, id: (before?.id ?? 0) + 1 }));
    setPicked(null);
    window.history.replaceState(null, '', here(login));
  };
  const pick = (name: string) => {
    setPicked(name);
    showInResult('repo-top');
  };

  const login = run?.login ?? '';
  const list = status?.list ?? [];
  // The first repo until one is picked, and again if the picked one is not in a new look.
  const selected = list.some((repo) => repo.name === picked) ? picked : list[0]?.name ?? null;
  const found = (status?.repos ?? 0) > 0;
  const thinking = (status?.pending ?? 0) > 0;
  const stages: Stage[] = [
    { label: '계정', state: login ? 'done' : 'now' },
    { label: status?.loading ? '레포 읽는 중' : '레포 읽기', state: found ? 'done' : login ? 'now' : 'todo' },
    { label: thinking ? `기능 제안 ${list.length - (status?.pending ?? 0)}/${list.length}` : '기능 제안', state: found && !thinking ? 'done' : found ? 'now' : 'todo' },
    { label: 'PRD', state: found && !thinking ? 'now' : 'todo' },
  ];

  const chat = (
    <>
      {login ? <Bubble role="user">github.com/{login.replace(/^@/, '')}</Bubble> : (
        <Bubble role="assistant">
          <p>GitHub 아이디나 주소를 아래에 적어 주세요.</p>
          <p className="mt-2">공개 레포 가운데 최근에 작업한 5개를 읽고, 레포마다 고칠 점과 더할 기능을 짚고, 그 레포의 PRD를 만듭니다. 비공개 레포는 읽지 않습니다.</p>
        </Bubble>
      )}
      {status?.loading && <Bubble role="assistant"><p className="flex items-start gap-2"><Loader2 aria-hidden="true" className="mt-1.5 h-4 w-4 shrink-0 animate-spin text-seed motion-reduce:animate-none" /><span>공개 레포를 읽는 중입니다.</span></p></Bubble>}
      {status?.error && <Bubble role="assistant"><p role="alert" className="text-ink">{status.error}</p></Bubble>}
      {status && status.repos === 0 && <Bubble role="assistant">읽을 공개 레포가 없습니다. 포크와 보관 처리된 레포는 빼고 봅니다.</Bubble>}
      {found && status && (
        <Bubble role="assistant">
          {status.savedAt
            ? <p>{formatDate(status.savedAt)}에 살펴본 레포 {status.repos}개입니다. <button type="button" onClick={() => ask(login)} className="font-medium text-seed underline underline-offset-4">다시 살펴보기</button>를 누르면 그 뒤에 새로 붙은 원문과 소식을 표시합니다.</p>
            : <p>레포 {status.repos}개를 찾았습니다. 하나를 고르면 고칠 점, 더할 기능, 가까운 개발자 불만과 그 레포의 PRD 만들기가 나옵니다.</p>}
          <ul className="mt-3 grid gap-1.5" aria-label="레포">
            {list.map((repo) => {
              const on = repo.name === selected;
              return (
                <li key={repo.name}>
                  <button type="button" onClick={() => pick(repo.name)} aria-pressed={on} className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors ${on ? 'border-outline-strong bg-surface-low' : 'border-outline-soft hover:border-outline-strong'}`}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[15px] font-semibold text-ink">{repo.name}</span>
                      {repo.language && <span className="shrink-0 text-[12px] text-muted">{repo.language}</span>}
                    </span>
                    {repo.description && <span className="mt-0.5 line-clamp-1 block text-[13px] leading-5 text-muted">{repo.description}</span>}
                    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                      {repo.waiting
                        ? <><Loader2 aria-hidden="true" className="h-3 w-3 animate-spin motion-reduce:animate-none" />기능 제안을 기다리는 중</>
                        : repo.features || repo.improvements
                          ? <>고칠 점 <span className="num text-ink">{repo.improvements}</span>, 더할 기능 <span className="num text-ink">{repo.features}</span></>
                          : '키워드로 맞춘 결과만'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {thinking && <p className="mt-3 text-[13px] text-muted">레포마다 1분쯤 걸릴 수 있습니다. 끝난 레포부터 볼 수 있습니다.</p>}
          {!thinking && status.needsLogin && <p className="mt-3"><Link href={`/login?next=${encodeURIComponent(here(login))}`} className="font-medium text-seed underline underline-offset-4">로그인</Link>하면 레포마다 AI가 더할 기능을 제안합니다. 지금은 키워드와 의미로 맞춘 결과만 보입니다.</p>}
          {!thinking && status.missed > 0 && <p className="mt-3">AI 모델이 답하지 않아 레포 {status.missed}개는 기능 제안을 만들지 못했습니다.</p>}
          {!thinking && !status.needsLogin && !status.savedAt && <p className="mt-3 text-[13px] text-muted">기능 제안은 AI가 레포 설명과 README만 읽고 쓴 것이라 틀릴 수 있습니다.</p>}
        </Bubble>
      )}
      {!userId && login && !status?.needsLogin && <Bubble role="assistant"><p className="text-[13px] text-muted">로그인 없이도 레포를 읽지만, 기능 제안과 PRD는 로그인한 뒤에 만들어집니다.</p></Bubble>}
      <Link href="/newsletter-preview?path=new" className="btn-quiet h-11">{t('새로 만들기', 'Build something new')}</Link>
    </>
  );

  return (
    <WorkSplit
      title={login ? `레포 분석, ${login}` : '레포 분석'}
      stages={stages}
      tools={signedIn ? <ModelPicker models={models} /> : undefined}
      chat={chat}
      composer={<ChatInput id="repo-input" label="GitHub 아이디 또는 주소" placeholder={login ? '다른 계정을 적으면 새로 읽습니다' : '예: torvalds'} onSend={ask} disabled={Boolean(status?.loading)} maxLength={80} />}
      result={run ? <div id="repo-top" className="mx-auto max-w-[1000px] scroll-mt-6"><SeedAdvisor run={run} onStatus={setStatus} loginNext={here(login)} selected={selected} userId={userId} models={models} /></div> : (
        <div className="mx-auto grid min-h-[220px] max-w-[1000px] place-items-center rounded-xl border border-dashed border-outline-strong p-6 text-center text-sm leading-6 text-muted">계정을 적으면 고른 레포의 분석 결과가 여기에 나옵니다.</div>
      )}
      resultLabel="분석 결과"
      onReset={() => { setRun(null); setStatus(null); setPicked(null); window.history.replaceState(null, '', '/prd/repo'); }}
    />
  );
}
