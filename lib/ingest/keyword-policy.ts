type KeywordGroup = {
  terms: string[];
  weight: number;
};

const CORE: KeywordGroup = {
  weight: 14,
  terms: [
    '개발',
    '프로그래밍',
    '코딩',
    'software',
    'developer',
    'engineering',
    'ai',
    '인공지능',
    '생성형 ai',
    'llm',
    '대형언어모델',
    'vibe coding',
    '바이브 코딩',
    'ai 코딩',
  ],
};

const BEGINNER: KeywordGroup = {
  weight: 18,
  terms: [
    '초보 개발자',
    '개발 입문',
    '코딩 입문',
    '비전공자 개발',
    '신입 개발자',
    '주니어 개발자',
    '개발 공부',
    '개발자 로드맵',
    'beginner developer',
    'junior developer',
    'learn coding',
    'developer roadmap',
  ],
};

const HANDS_ON: KeywordGroup = {
  weight: 20,
  terms: [
    '튜토리얼',
    '가이드',
    '입문 가이드',
    '실습',
    '예제',
    '샘플 코드',
    '따라하기',
    '만들기',
    '구현하기',
    '시작하기',
    'hands-on',
    'walkthrough',
    'getting started',
    'how to build',
    'starter project',
    'practical guide',
    'implementation guide',
    'build log',
    'developer workflow',
    'cli tutorial',
    '실무 팁',
    '구현기',
    '빌딩 로그',
    '개발 워크플로',
    '터미널',
    '명령줄',
  ],
};

const PROJECT: KeywordGroup = {
  weight: 22,
  terms: [
    '사이드 프로젝트',
    '토이 프로젝트',
    '미니 프로젝트',
    '프로젝트 아이디어',
    '개발 아이디어',
    '서비스 아이디어',
    'saas 아이디어',
    '창업 아이디어',
    'mvp',
    '프로토타입',
    '자동화 서비스',
    '생산성 도구',
    '대시보드',
    '추천 서비스',
    'side project',
    'toy project',
    'project idea',
    'micro saas',
    'build in public',
    'automation tool',
    'productivity app',
    'recommendation system',
  ],
};

const AI_AGENT: KeywordGroup = {
  weight: 20,
  terms: [
    'ai agent',
    'ai 에이전트',
    'agentic ai',
    '에이전틱 ai',
    'rag',
    '검색증강생성',
    'vector db',
    '벡터db',
    'embedding',
    '임베딩',
    '프롬프트',
    'fine-tuning',
    '오픈소스 llm',
    '로컬 llm',
    'ai 챗봇',
    'ai 자동화',
    '코드 생성',
    '코드 리뷰',
    'openai',
    'claude',
    'gemini',
    'cursor',
    'windsurf',
    'github copilot',
    'codex',
    'claude code',
    'cursor cli',
    'ai coding',
    'agent workflow',
    'hugging face',
    'langchain',
    'llamaindex',
    'crewai',
    'autogen',
    'mcp',
    'model context protocol',
    'glm',
    '모델 추론',
    '추론 서버',
    'local model',
  ],
};

const WEB_APP: KeywordGroup = {
  weight: 12,
  terms: [
    '웹 개발',
    '프론트엔드',
    '백엔드',
    '풀스택',
    '웹앱',
    'api 개발',
    '인증',
    '결제',
    '대시보드',
    'typescript',
    'react',
    'next.js',
    'node.js',
    'nestjs',
    'spring boot',
    'django',
    'fastapi',
    'frontend',
    'backend',
    'full-stack',
    'web app',
    'authentication',
  ],
};

const DATA_AUTOMATION: KeywordGroup = {
  weight: 14,
  terms: [
    '데이터 분석',
    '데이터 시각화',
    '크롤링',
    '스크래핑',
    '자동화',
    '업무 자동화',
    '뉴스 요약',
    '문서 요약',
    '트렌드 분석',
    '추천 알고리즘',
    'python',
    'pandas',
    'playwright',
    'web scraping',
    'automation',
    'workflow automation',
    'data analysis',
    'recommendation',
  ],
};

const INFRA_TOOLING: KeywordGroup = {
  weight: 10,
  terms: [
    'supabase',
    'firebase',
    'vercel',
    'cloudflare',
    'docker',
    'kubernetes',
    'github actions',
    'devops',
    'ci/cd',
    '모니터링',
    '테스트',
    '디버깅',
    '리팩토링',
    '개발 생산성',
    'developer tools',
  ],
};

const BACKEND_DATA: KeywordGroup = {
  weight: 16,
  terms: [
    'postgres',
    'postgresql',
    'mysql',
    'redis',
    'kafka',
    'grpc',
    'graphql',
    'presto',
    'trino',
    'sql',
    'database',
    '데이터베이스',
    '분산 시스템',
    'distributed systems',
    'rust',
    'golang',
    'kotlin',
    'java',
    'gpu',
    'analytics',
    '데이터 파이프라인',
  ],
};

const SECURITY_RELIABILITY: KeywordGroup = {
  weight: 16,
  terms: [
    '보안',
    '취약점',
    '비밀키',
    '환경 변수',
    'environment variable',
    'sensitive environment',
    'secret',
    'vulnerability',
    'security',
    'privacy',
    '로그 마스킹',
    'rate limit',
    'observability',
    '신뢰성',
    'reliability',
  ],
};

const PRODUCT_CAREER: KeywordGroup = {
  weight: 8,
  terms: [
    '포트폴리오',
    '기술 면접',
    '개발자 커리어',
    '제품 개발',
    'product management',
    'growth',
    'retention',
    'onboarding',
    'startup',
    'indie hacker',
    'user research',
    'business model',
  ],
};

const SOFT_EXCLUDES = [
  'mou',
  '업무협약',
  '파트너십 체결',
  '수상',
  '선정',
  '행사 개최',
  '컨퍼런스 개최',
  '전시회 참가',
  '부스 운영',
  '출시 기념',
  '할인',
  '이벤트',
  '프로모션',
  '광고',
  '수강생 모집',
  '교육생 모집',
  '채용공고',
  '공채',
  '인사',
];

const HARD_EXCLUDES = [
  '관련주',
  '테마주',
  '주가',
  '급등',
  '급락',
  '투자 유치',
  '상장',
  'ipo',
  '실적 발표',
  '영업이익',
  '주식',
  // '코인', '토큰' 단독 제거: LLM 토큰(token), 코인 지갑 등 개발 문맥에서 오탐 발생
  // → 금융 맥락이 명확한 복합어만 차단
  '가상자산',
  '코인 시세',
  '암호화폐 토큰',
  '코인 거래소',
  '부음',
  '정치',
];

const GROUPS = [CORE, BEGINNER, HANDS_ON, PROJECT, AI_AGENT, WEB_APP, DATA_AUTOMATION, INFRA_TOOLING, BACKEND_DATA, SECURITY_RELIABILITY, PRODUCT_CAREER];

export type KeywordPolicyResult = {
  shouldAnalyze: boolean;
  score: number;
  matched: string[];
  softExcluded: string[];
  hardExcluded: string[];
};

export function evaluateArticleKeywordPolicy(input: { title: string; content: string; source?: string }) {
  const title = normalize(input.title);
  const text = normalize(`${input.title}\n${input.content}\n${input.source ?? ''}`);
  // Broad terms such as "주식" or "정치" can appear incidentally in technical
  // articles. Require hard exclusions to appear in the headline first.
  const hardExcluded = matchingTerms(title, HARD_EXCLUDES);
  if (hardExcluded.length) {
    return { shouldAnalyze: false, score: -100, matched: [], softExcluded: [], hardExcluded } satisfies KeywordPolicyResult;
  }

  const softExcluded = matchingTerms(text, SOFT_EXCLUDES);
  const matched: string[] = [];
  let score = 0;

  for (const group of GROUPS) {
    const terms = matchingTerms(text, group.terms);
    if (!terms.length) continue;
    matched.push(...terms.slice(0, 4));
    score += group.weight + Math.min(terms.length - 1, 3) * 3;
  }

  score -= softExcluded.length * 18;

  return {
    shouldAnalyze: score >= 12,
    score,
    matched: Array.from(new Set(matched)).slice(0, 12),
    softExcluded,
    hardExcluded,
  } satisfies KeywordPolicyResult;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ');
}

function matchingTerms(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term.toLowerCase()));
}
