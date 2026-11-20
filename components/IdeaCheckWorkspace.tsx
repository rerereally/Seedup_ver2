'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EvaluationPanel, normalizeEvaluation } from '@/components/IdeaEvaluation';
import type { RecentIdea } from '@/components/IdeaEvaluation';
import { useLang } from '@/components/LangProvider';
import ValidationReportPanel from '@/components/ValidationReportPanel';
import WorkSplit, { Bubble, ChatInput, showInResult } from '@/components/WorkSplit';
import type { Stage } from '@/components/WorkSplit';
import { translator } from '@/lib/i18n';

const EXAMPLES = [
  ['데일리 이슈 리포트 봇', 'Daily issue digest bot', '놓치기 쉬운 GitHub 이슈 변경을 요약해 매일 팀 Slack으로 보내는 도구', 'Send a daily Slack digest of GitHub issue updates teams might otherwise miss.'],
  ['논문 구현 아이디어', 'Research-to-project ideas', '논문 초록을 작은 실험과 구현 가능한 프로젝트로 바꿔 주는 웹앱', 'Turn research abstracts into small experiments and implementation projects.'],
  ['DB CLI 통합', 'Unified database CLI', '데이터베이스마다 다른 CLI 명령을 하나로 묶는 개발자 도구', 'Unify commands for multiple database CLIs in one developer tool.'],
] as const;
const chip = 'min-h-10 max-w-full rounded-2xl border border-outline-soft bg-white px-3.5 py-2 text-left text-[13px] leading-5 text-tertiary hover:border-outline-strong hover:text-ink';

export default function IdeaCheckWorkspace({ initialIdea, previous, recent, signedIn }: {
  initialIdea: string;
  previous: RecentIdea | null;
  recent: Array<Pick<RecentIdea, 'id' | 'idea_text' | 'score'>>;
  signedIn: boolean;
}) {
  const t = translator(useLang());
  const [idea, setIdea] = useState(initialIdea);
  const [ran, setRan] = useState(false);
  const [keepPrevious, setKeepPrevious] = useState(true);
  const valid = idea.trim().length >= 4;
  const here = (text: string) => `/prd/validate?idea=${encodeURIComponent(text)}`;
  const saved = keepPrevious ? previous : null;
  const otherRecent = recent.filter((item) => item.id !== saved?.id);

  const selectIdea = (text: string) => {
    if (text === idea && !saved) {
      showInResult('check-report');
      return;
    }
    setIdea(text);
    setRan(false);
    setKeepPrevious(false);
    window.history.replaceState(null, '', text ? here(text) : '/prd/validate');
    if (text.length >= 4) showInResult('check-report');
  };

  const stages: Stage[] = [
    { label: t('아이디어', 'Idea'), state: valid ? 'done' : 'now' },
    { label: t('검증 리포트', 'Validation report'), state: ran ? 'done' : valid ? 'now' : 'todo' },
    { label: t('다음 실험', 'Next experiment'), state: ran ? 'now' : 'todo' },
  ];
  const chat = (
    <>
      {idea ? <Bubble role="user">{idea}</Bubble> : (
        <Bubble role="assistant">
          <p>{t('누가 겪는 어떤 문제를 어떻게 풀지 한 줄로 적어 주세요.', 'Describe whose problem you want to solve and how, in one line.')}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map(([ko, en, ideaKo, ideaEn]) => <button key={en} type="button" className={chip} onClick={() => selectIdea(t(ideaKo, ideaEn))}>{t(ko, en)}</button>)}
          </div>
        </Bubble>
      )}
      {valid && (
        <Bubble role="assistant">
          <p>{signedIn
            ? t('실패할 가능성부터 살펴보고, 출처가 있는 원문과 경쟁 도구, 이어서 해 볼 실험을 정리합니다.', 'Start with what could go wrong, then review source quotes, competitors, and experiments you can run.')
            : t('로그인하면 원문을 바탕으로 검증 리포트를 만들 수 있습니다.', 'Sign in to create a validation report grounded in source quotes.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {signedIn
              ? <button type="button" onClick={() => showInResult('check-report')} className="btn h-10 px-4">{t('검증 화면 보기', 'Open validation')}</button>
              : <Link href={`/login?next=${encodeURIComponent(here(idea))}`} className="btn h-10 px-4">{t('로그인하고 검증하기', 'Sign in to validate')}</Link>}
          </div>
        </Bubble>
      )}
      {otherRecent.length > 0 && (
        <Bubble role="assistant">
          <p className="text-[13px] text-muted">{t('저장된 AI 참고 평가', 'Saved AI assessments')}</p>
          <ul className="rows mt-1">
            {otherRecent.map((item) => (
              <li key={item.id}>
                <Link href={`/prd/validate?evaluation=${encodeURIComponent(item.id)}`} className="group flex items-baseline gap-3 py-2.5 text-sm">
                  <span className="line-clamp-1 min-w-0 flex-1 text-ink group-hover:underline">{item.idea_text}</span>
                  <span className="num shrink-0 text-muted">{item.score ?? '–'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Bubble>
      )}
    </>
  );

  return (
    <WorkSplit
      title={idea || t('아이디어 검증', 'Idea validation')}
      stages={stages}
      chat={chat}
      composer={<ChatInput id="check-input" label={t('검증할 아이디어', 'Idea to validate')} placeholder={t('예: 데이터베이스마다 다른 CLI 명령을 하나로 묶는 도구', 'For example, one CLI for multiple databases')} onSend={selectIdea} />}
      result={(
        <div className="mx-auto grid max-w-[1000px] gap-6">
          {valid ? <div id="check-report" className="scroll-mt-6">
            <ValidationReportPanel key={idea} idea={idea} isLoggedIn={signedIn} onComplete={() => setRan(true)} />
          </div> : <p className="rounded-xl border border-dashed border-outline-strong p-6 text-sm text-muted">{t('아이디어를 한 줄로 적으면 검증을 시작할 수 있습니다.', 'Enter an idea to start validation.')}</p>}
          {saved && <details className="rounded-xl border border-outline-soft p-4">
            <summary className="cursor-pointer font-semibold">{t('저장된 AI 평가 보기 (참고)', 'View saved AI assessment (reference)')}</summary>
            <EvaluationPanel run={{ id: saved.id, idea: saved.idea_text, saved: true, result: normalizeEvaluation(saved.result) }} />
          </details>}
        </div>
      )}
      resultLabel={t('검증 결과', 'Validation result')}
      onReset={() => selectIdea('')}
    />
  );
}
