'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EvaluationPanel, normalizeEvaluation } from '@/components/IdeaEvaluation';
import type { EvaluationRun, RecentIdea } from '@/components/IdeaEvaluation';
import ModelPicker, { usePrdModel } from '@/components/ModelPicker';
import ValidationReportPanel from '@/components/ValidationReportPanel';
import type { PrdModel } from '@/lib/opportunities/models';
import WorkSplit, { Bubble, ChatInput, showInResult } from '@/components/WorkSplit';
import type { Stage } from '@/components/WorkSplit';
import { evaluationById, recentEvaluations } from '@/lib/db/evaluations';
import { createClient } from '@/lib/supabase/client';

type Status = 'idle' | 'saving' | 'done' | 'error';

// Ideas to try when the chat is empty: [button label, the idea].
const EXAMPLES: Array<[string, string]> = [
  ['데일리 이슈 리포트 봇', '개발팀이 놓치는 이슈 변경을 줄이기 위해, 저장소 이슈를 요약해 매일 팀 Slack으로 보내는 자동화 도구'],
  ['논문 구현 아이디어', 'AI를 공부하는 개발자가 논문 초록을 넣으면 작은 실험과 구현 가능한 프로젝트로 바꿔 주는 웹앱'],
  ['DB CLI 통합', '데이터베이스마다 다른 CLI 명령을 하나로 묶어 주는 개발자 도구'],
];

const chip = 'min-h-10 max-w-full rounded-2xl border border-outline-soft bg-white px-3.5 py-2 text-left text-[13px] leading-5 text-tertiary hover:border-outline-strong hover:text-ink';

/** Idea validation in the /prd work frame: the idea and what the check found on the left, the full report on the right. */
export default function IdeaCheckWorkspace({ initialIdea, evaluationId, signedIn, models = [] }: { initialIdea: string; evaluationId: string | null; signedIn: boolean; models?: PrdModel[] }) {
  const model = usePrdModel(models);
  const [idea, setIdea] = useState(initialIdea);
  const [status, setStatus] = useState<Status>('idle');
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<RecentIdea[]>([]);
  const runRef = useRef(0);
  const here = (text: string) => `/prd/validate?idea=${encodeURIComponent(text)}`;

  const evaluate = async (text: string) => {
    const ticket = (runRef.current += 1);
    setIdea(text);
    setRun(null);
    setError('');
    // The address follows the idea, so a reload or a shared link shows the same check.
    window.history.replaceState(null, '', here(text));
    if (!signedIn) {
      setStatus('idle');
      return;
    }
    setStatus('saving');
    try {
      const response = await fetch('/api/ideas/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea: text, model }) });
      const json = await response.json().catch(() => null);
      if (ticket !== runRef.current) return;
      if (!response.ok) {
        setStatus('error');
        setError(typeof json?.error === 'string' ? json.error : '분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setRun({ id: typeof json.id === 'string' ? json.id : null, idea: text, saved: Boolean(json.saved), result: { ...normalizeEvaluation(json.evaluation), references: json.references ?? [] } });
      setStatus('done');
    } catch {
      if (ticket !== runRef.current) return;
      setStatus('error');
      setError('네트워크가 끊겼거나 평가 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  // A saved evaluation opens as it was; a new idea is checked once, on arrival.
  const start = useEffectEvent(() => {
    const supabase = evaluationId ? createClient() : null;
    if (evaluationId && supabase) {
      void evaluationById(supabase, evaluationId).then(({ data }) => {
        if (!data) return;
        const item = data as RecentIdea;
        setIdea(item.idea_text);
        setRun({ id: item.id, idea: item.idea_text, saved: true, result: normalizeEvaluation(item.result) });
        setStatus('done');
      });
    } else if (initialIdea) void evaluate(initialIdea);
  });
  useEffect(() => {
    const timer = window.setTimeout(() => start(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const supabase = signedIn ? createClient() : null;
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await recentEvaluations(supabase, data.user.id, 4);
      setRecent((rows ?? []) as RecentIdea[]);
    });
  }, [signedIn, status]);

  const others = recent.filter((item) => item.id !== run?.id).slice(0, 3);
  const done = Boolean(run && status === 'done');
  const evaluation = done ? run!.result : null;
  const risk = evaluation?.structured_risks?.[0];
  const firstStep = evaluation?.structured_next_steps?.[0];
  const stages: Stage[] = [
    { label: '아이디어', state: idea ? 'done' : 'now' },
    { label: status === 'saving' ? '평가 중' : '평가', state: done ? 'done' : idea ? 'now' : 'todo' },
    { label: '원문 리포트', state: done ? 'now' : 'todo' },
    { label: 'PRD', state: 'todo' },
  ];

  const chat = (
    <>
      {idea ? <Bubble role="user">{idea}</Bubble> : (
        <Bubble role="assistant">
          <p>검증할 아이디어를 아래에 적어 주세요. 누가 겪는 어떤 문제를 어떻게 풀지 한 줄이면 됩니다.</p>
          <p className="mt-2">시장성, 차별성, 구현 난이도, 포트폴리오 가치, MVP 계획을 점수로 매기고, 이 문제를 실제로 겪는 개발자의 글도 찾아 붙입니다.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map(([label, text]) => <button key={label} type="button" onClick={() => void evaluate(text)} title={text} className={chip}>{label}</button>)}
          </div>
        </Bubble>
      )}
      {idea && !signedIn && (
        <Bubble role="assistant">
          <p>평가는 로그인한 뒤에 할 수 있습니다. 실제 개발자 글을 찾는 원문 리포트는 지금도 만들 수 있습니다.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/login?next=${encodeURIComponent(here(idea))}`} className="btn h-10 px-4">로그인하고 평가하기</Link>
            <button type="button" onClick={() => showInResult('check-report')} className="btn-quiet h-10 px-4">원문 리포트 보기</button>
          </div>
        </Bubble>
      )}
      {status === 'saving' && (
        <Bubble role="assistant">
          <p className="flex items-start gap-2"><Loader2 aria-hidden="true" className="mt-1.5 h-4 w-4 shrink-0 animate-spin text-seed motion-reduce:animate-none" /><span>시장성, 차별성, 구현 난이도, 포트폴리오 가치, MVP 계획을 보고 있습니다. 1분 가까이 걸릴 수 있습니다.</span></p>
        </Bubble>
      )}
      {status === 'error' && (
        <Bubble role="assistant">
          <p role="alert" className="text-ink">{error}</p>
          <button type="button" onClick={() => void evaluate(idea)} className="btn mt-3 h-10 px-4">다시 시도</button>
        </Bubble>
      )}
      {evaluation && run && (
        <>
          <Bubble role="assistant">
            <p><b className="num text-[17px] font-bold text-ink">{evaluation.score}점</b>, {evaluation.verdict}</p>
          </Bubble>
          {!!evaluation.weaknesses?.length && (
            <Bubble role="assistant">
              <p className="font-semibold text-ink">보완할 점</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{evaluation.weaknesses.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
            </Bubble>
          )}
          {risk && (
            <Bubble role="assistant">
              <p className="font-semibold text-ink">가장 큰 위험</p>
              <p className="mt-1">{risk.title}</p>
              <p className="mt-1 text-[14px]"><span className="text-muted">대응</span> {risk.mitigation}</p>
            </Bubble>
          )}
          {firstStep && (
            <Bubble role="assistant">
              <p className="font-semibold text-ink">먼저 할 일</p>
              <p className="mt-1">{firstStep.title}</p>
            </Bubble>
          )}
          <Bubble role="assistant">
            <p>다음으로 이 문제를 겪는 사람의 실제 글을 찾아 보세요. 원문이 있으면 PRD의 요구사항이 가설이 아니라 근거가 됩니다.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => showInResult('check-report')} className="btn h-10 px-4">원문 리포트 보기</button>
              <Link href={`/prd/new?idea=${encodeURIComponent(run.idea)}`} className="btn-quiet h-10 px-4">이 아이디어로 PRD 만들기</Link>
              <button type="button" onClick={() => showInResult('check-evaluation')} className="btn-quiet h-10 px-4">평가 전체 보기</button>
            </div>
          </Bubble>
        </>
      )}
      {others.length > 0 && (
        <Bubble role="assistant">
          <p className="text-[13px] text-muted">지난 평가</p>
          <ul className="rows mt-1">
            {others.map((item) => (
              <li key={item.id}>
                <Link href={`/prd/validate?evaluation=${item.id}`} className="group flex items-baseline gap-3 py-2.5 text-sm">
                  <span className="line-clamp-1 min-w-0 flex-1 text-ink group-hover:underline group-hover:underline-offset-4">{item.idea_text}</span>
                  <span className="num shrink-0 text-muted">{item.score ?? '–'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Bubble>
      )}
    </>
  );

  const result = (
    <div className="mx-auto grid max-w-[1000px] gap-10">
      <div id="check-evaluation" className="scroll-mt-6">
        {run && done ? <EvaluationPanel run={run} /> : (
          <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-outline-strong p-6 text-center text-sm leading-6 text-muted">
            {status === 'saving' ? '평가가 끝나면 점수 근거, 위험, MVP 순서가 여기에 나옵니다.' : idea ? (signedIn ? '평가 결과가 여기에 나옵니다.' : '로그인하면 평가 결과가 여기에 나옵니다.') : '아이디어를 적으면 평가 결과가 여기에 나옵니다.'}
          </div>
        )}
      </div>
      {idea.trim().length >= 4 && <div id="check-report" className="scroll-mt-6"><ValidationReportPanel key={idea} idea={idea} isLoggedIn={signedIn} /></div>}
    </div>
  );

  return (
    <WorkSplit
      title={idea || '아이디어 검증'}
      stages={stages}
      tools={signedIn ? <ModelPicker models={models} /> : undefined}
      chat={chat}
      composer={<ChatInput id="check-input" label="검증할 아이디어" placeholder={idea ? '다른 아이디어를 적으면 새로 평가합니다' : '예: 데이터베이스마다 다른 CLI 명령을 하나로 묶는 도구'} onSend={(text) => void evaluate(text)} disabled={status === 'saving'} />}
      result={result}
      resultLabel="평가 결과"
      onReset={() => { runRef.current += 1; setIdea(''); setRun(null); setStatus('idle'); setError(''); window.history.replaceState(null, '', '/prd/validate'); }}
    />
  );
}
