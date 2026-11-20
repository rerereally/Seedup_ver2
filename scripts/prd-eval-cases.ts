import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { specInputFor } from '../lib/opportunities/context';
import { PROBLEM_CASES } from '../lib/opportunities/eval';
import { ideaSpecInput } from '../lib/opportunities/idea';
import { PRD_MAX_EVIDENCE } from '../lib/opportunities/prd-cache';
import type { SpecInput } from '../lib/opportunities/spec';
import type { OpportunitySnapshot } from '../lib/opportunities/types';

// Ideas typed the way people type them on the site, with no quotes: the PRD must keep unbacked lines as hypotheses.
const IDEA_CASES = [
  '사이드 프로젝트 API 키가 GitHub에 올라가면 바로 알려 주는 도구',
  'Cursor로 만든 앱의 Supabase 보안 설정을 점검해 주는 서비스',
  '개발 블로그 글을 읽고 내 저장소에 바로 적용할 할 일로 바꿔 주는 도구',
  '혼자 운영하는 SaaS의 월 AI API 비용을 기능별로 보여 주는 대시보드',
  '오픈소스 이슈 중 초보자가 고칠 만한 것만 매일 추천하는 메일',
  '회의록을 넣으면 Linear 이슈로 쪼개 주는 도구',
  '바이브코딩으로 만든 앱의 첫 사용자 10명을 찾아 주는 서비스',
  '여러 LLM 응답을 같은 질문으로 비교해 주는 데스크톱 앱',
];

export type PrdEvalCase = { id: string; kind: 'problem' | 'idea'; input: SpecInput | null };

export function prdEvalSnapshot() {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'lib/opportunities/data/snapshot.json'), 'utf8')) as OpportunitySnapshot;
}

export function prdEvalCases(snapshot = prdEvalSnapshot()): PrdEvalCase[] {
  return [
    ...PROBLEM_CASES.map((slug) => {
      const opportunity = snapshot.opportunities.find((item) => item.slug === slug);
      const picked = (opportunity?.evidence ?? []).slice(0, PRD_MAX_EVIDENCE).map((evidence) => ({ evidence, slug }));
      return { id: slug, kind: 'problem' as const, input: opportunity ? specInputFor(snapshot.opportunities, picked) : null };
    }),
    ...IDEA_CASES.map((idea, index) => ({ id: `idea-${index + 1}`, kind: 'idea' as const, input: ideaSpecInput(snapshot.opportunities, { idea, answers: [] }, []) })),
  ] satisfies PrdEvalCase[];
}
