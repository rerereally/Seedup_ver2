import type { ExportFormat } from '@/lib/opportunities/spec';

export const ONBOARDING_TOOL_STORAGE_KEY = 'seedup:onboarding-tool';

export const onboardingQuestions = [
  {
    id: 'interests',
    title: '관심 분야를 선택해주세요.',
    type: 'multi',
    options: ['AI/LLM', '프론트엔드', '백엔드', '앱 개발', '데이터/ML', 'DevOps/클라우드', '게임 개발', '오픈소스', '창업/사이드프로젝트', '잘 모르겠음'],
  },
  {
    id: 'level',
    title: '현재 개발 수준은 어디에 가장 가까운가요?',
    type: 'single',
    options: ['입문자: 개발을 막 시작했어요', '초보자: 간단한 프로젝트는 만들 수 있어요', '중급자: 서비스 구조와 배포까지 어느 정도 알아요', '실무자: 실무 관점의 깊은 내용을 원해요', '잘 모르겠음'],
  },
  {
    id: 'preferred_tool',
    title: '주로 쓰는 AI 코딩 도구는 무엇인가요?',
    type: 'single',
    options: ['Cursor', 'Claude Code', 'Codex · Antigravity · VS Code', 'Lovable · Bolt · v0', '아직 없음'],
  },
  {
    id: 'goals',
    title: '현재 목표는 무엇인가요?',
    type: 'multi',
    options: ['취업/이직 준비', '포트폴리오 만들기', '사이드 프로젝트 만들기', '창업 아이디어 찾기', '최신 개발 트렌드 파악', '논문/연구 흐름 파악', '실무 역량 강화', '아직 없음'],
  },
  {
    id: 'preferred_roles',
    title: '희망 직무나 방향을 골라주세요.',
    type: 'multi',
    options: ['프론트엔드 개발자', '백엔드 개발자', '풀스택 개발자', 'AI 앱 빌더', 'AI/ML 엔지니어', '데이터 엔지니어', 'DevOps/클라우드 엔지니어', '앱 개발자', '게임 개발자', '창업자/메이커', '아직 모르겠음'],
  },
  {
    id: 'content_preferences',
    title: '어떤 콘텐츠를 더 자주 받고 싶나요?',
    type: 'multi',
    options: ['짧은 요약 브리핑', '깊은 분석글', 'AI 제품 추천', 'GitHub 오픈소스 추천', '프로젝트 아이디어', '직무별 실무팁', '논문을 쉽게 풀어쓴 글', '잘 모르겠음'],
  },
  {
    id: 'preferred_stack',
    title: '선호하거나 배우고 싶은 기술 스택은 무엇인가요?',
    type: 'multi',
    options: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'FastAPI', 'Spring', 'Supabase', 'PostgreSQL', 'Docker', 'AWS', 'Cloudflare', 'LLM API', '아직 모르겠음'],
  },
] as const;

export type OnboardingAnswers = Record<string, string | string[]>;

export function preferredStack(answers: unknown) {
  const stack = (answers as Partial<OnboardingAnswers> | null)?.preferred_stack;
  return [stack].flat().filter((value): value is string => typeof value === 'string' && Boolean(value.trim()) && value !== '아직 모르겠음');
}

/** 입문자·초보자 answers to the level question; they get a smaller, plain-language PRD. */
export function isBeginner(answers: unknown) {
  const level = (answers as Record<string, unknown> | null | undefined)?.level;
  return [level].flat().some((value) => /^(입문자|초보자)/.test(String(value ?? '')));
}

const DEFAULT_EXPORT_ORDER: ExportFormat[] = ['agents', 'claude', 'cursor', 'prompt'];

/** Maps an onboarding tool answer (e.g. "Cursor", "Claude Code", "Lovable · Bolt · v0") to a PRD export format. */
export function preferredExportFormat(answers: unknown): ExportFormat | null {
  if (!answers) return null;
  const values: string[] = [];
  if (typeof answers === 'string') {
    values.push(answers);
  } else if (typeof answers === 'object') {
    const record = answers as Record<string, unknown>;
    for (const key of ['preferred_tool', 'coding_tool', 'tool', 'tools', 'preferred_stack']) {
      const entry = record[key];
      if (typeof entry === 'string') values.push(entry);
      else if (Array.isArray(entry)) values.push(...entry.map(String));
    }
  }
  for (const raw of values) {
    const text = raw.trim();
    if (!text || text === '아직 없음' || text === '잘 모르겠음') continue;
    if (/\bcursor\b/i.test(text)) return 'cursor';
    if (/\bclaude\b/i.test(text)) return 'claude';
    if (/lovable|bolt|\bv0\b|prompt/i.test(text)) return 'prompt';
    if (/codex|antigravity|vs\s*code|agents\.md|\bagents\b|gemini|windsurf/i.test(text)) return 'agents';
  }
  return null;
}

/** Returns the primary export format and the folded "other tools" list, preserving the default order when none was picked. */
export function exportFormatOrder(preferred?: ExportFormat | null): {
  primary: ExportFormat;
  others: ExportFormat[];
  hasPreference: boolean;
} {
  const valid = preferred && DEFAULT_EXPORT_ORDER.includes(preferred) ? preferred : null;
  const primary: ExportFormat = valid ?? 'agents';
  return {
    primary,
    others: DEFAULT_EXPORT_ORDER.filter((format) => format !== primary),
    hasPreference: valid !== null,
  };
}
