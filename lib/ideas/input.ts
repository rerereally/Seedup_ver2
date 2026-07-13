import { createHash } from 'node:crypto';

const ABUSIVE_LANGUAGE = [
  /(?:씨발|시발|ㅅㅂ|ㅆㅂ|병신|븅신|좆|개새끼|개새|지랄)/i,
  /\b(?:fuck|shit|bitch|asshole)\b/i,
];

const IDEA_SIGNALS = /(?:앱|서비스|도구|봇|프로젝트|플랫폼|대시보드|에이전트|자동화|추천|분석|관리|검색|연결|구현|만들|개발|api|sdk|cli|saas|agent|dashboard|report|github|issue|workflow)/i;

export type IdeaInputValidation =
  | { ok: true; idea: string; key: string }
  | { ok: false; message: string };

export function validateIdeaInput(value: string): IdeaInputValidation {
  const idea = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const words = idea.match(/[A-Za-z0-9가-힣][A-Za-z0-9가-힣+.#/_-]*/g) ?? [];

  if (ABUSIVE_LANGUAGE.some((pattern) => pattern.test(idea))) {
    return { ok: false, message: '욕설이나 비하 표현은 평가할 수 없습니다. 해결할 문제와 대상 사용자를 적어주세요.' };
  }

  if (idea.length < 8 || words.length < 2) {
    return { ok: false, message: '평가하려는 아이디어를 한두 문장으로 조금 더 구체적으로 적어주세요.' };
  }

  if (!IDEA_SIGNALS.test(idea)) {
    return { ok: false, message: '프로젝트의 대상 사용자, 해결할 문제, 또는 만들 기능 중 하나를 포함해 적어주세요.' };
  }

  return {
    ok: true,
    idea,
    key: createHash('sha256').update(idea.toLowerCase()).digest('hex'),
  };
}
