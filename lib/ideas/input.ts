import { createHash } from 'node:crypto';

const ABUSIVE_LANGUAGE = [
  /(?:씨발|시발|ㅅㅂ|ㅆㅂ|병신|븅신|좆|개새끼|개새|지랄)/i,
  /\b(?:fuck|shit|bitch|asshole)\b/i,
];

const IDEA_SIGNALS = /(?:앱|서비스|도구|봇|프로젝트|플랫폼|대시보드|에이전트|자동화|추천|분석|관리|검색|연결|구현|만들|개발|큐레이션|슬랙|팀|사용자|문제|기능|api|sdk|cli|saas|agent|dashboard|report|github|issue|workflow|product\s*hunt|slack|curation|user|problem|feature)/i;

const MAX_IDEA_LENGTH = 2_000;

export type IdeaInputValidation =
  | { ok: true; idea: string; key: string }
  | { ok: false; message: string };

export function validateIdeaInput(value: string): IdeaInputValidation {
  const idea = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const words = idea.match(/[A-Za-z0-9가-힣][A-Za-z0-9가-힣+.#/_-]*/g) ?? [];

  if (ABUSIVE_LANGUAGE.some((pattern) => pattern.test(idea))) {
    return { ok: false, message: '욕설이나 비하 표현은 평가할 수 없습니다. 해결할 문제와 대상 사용자를 적어주세요.' };
  }

  if (idea.length > MAX_IDEA_LENGTH) {
    return { ok: false, message: `아이디어는 ${MAX_IDEA_LENGTH.toLocaleString('ko-KR')}자 이내로 적어주세요.` };
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

const KO_AUDIENCES = [
  '프론트엔드 개발자',
  '백엔드 개발자',
  '풀스택 개발자',
  '1인 개발자',
  '초보 개발자',
  '입문 개발자',
  '소상공인',
  '자영업자',
  '프리랜서',
  '디자이너',
  '대학원생',
  '대학생',
  '직장인',
  '마케터',
  '개발자',
  '창업자',
  '연구자',
  '기획자',
  '학생',
  '부모',
  '교사',
  'PM',
] as const;

const EN_AUDIENCES: Array<[RegExp, string]> = [
  [/\bsolo\s+developers?\b/i, 'Solo developers'],
  [/\bsmall\s+(?:dev\s+)?teams?\b/i, 'Small dev teams'],
  [/\bsmall\s+business\s+owners?\b/i, 'Small business owners'],
  [/\bproduct\s+managers?\b|\bpms?\b/i, 'Product managers'],
  [/\bcollege\s+students?\b|\buniversity\s+students?\b/i, 'College students'],
  [/\bstudents?\b/i, 'Students'],
  [/\bfreelancers?\b/i, 'Freelancers'],
  [/\bdesigners?\b/i, 'Designers'],
  [/\bmarketers?\b/i, 'Marketers'],
  [/\bdevelopers?\b/i, 'Developers'],
  [/\bparents?\b/i, 'Parents'],
  [/\bteachers?\b/i, 'Teachers'],
  [/\bfounders?\b/i, 'Founders'],
  [/\bresearchers?\b/i, 'Researchers'],
];

function matchKoAudience(text: string): string | null {
  const sorted = [...KO_AUDIENCES].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (/^[A-Za-z]+$/.test(word)) {
      if (new RegExp(`(?:^|[^A-Za-z])${word}(?=$|[^A-Za-z])`, 'i').test(text)) return word;
    } else if (text.includes(word)) {
      return word;
    }
  }
  return null;
}

function matchEnAudience(text: string): string | null {
  for (const [pattern, label] of EN_AUDIENCES) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/** Extracts a target audience noun from a one-line idea by rule (longer words first), or returns null. */
export function ideaAudience(idea: string, lang: 'ko' | 'en' = 'ko'): string | null {
  const text = idea.normalize('NFKC').trim();
  if (!text) return null;
  return lang === 'en'
    ? matchEnAudience(text) ?? matchKoAudience(text)
    : matchKoAudience(text) ?? matchEnAudience(text);
}
