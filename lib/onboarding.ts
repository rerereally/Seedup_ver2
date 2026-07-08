export const onboardingQuestions = [
  {
    id: 'level',
    title: '현재 개발 수준은 어디에 가장 가까운가요?',
    type: 'single',
    options: ['입문', '초급', '중급', '고급'],
  },
  {
    id: 'interests',
    title: '관심 분야를 선택해주세요.',
    type: 'multi',
    options: ['AI', '웹개발', '프론트엔드', '백엔드', '모바일', '게임', '데이터', '오픈소스', '창업'],
  },
  {
    id: 'goal',
    title: 'Seedup을 쓰는 가장 큰 목적은 무엇인가요?',
    type: 'multi',
    options: ['개발 트렌드 파악', '포트폴리오 프로젝트 찾기', '취업 준비', '논문·기술 학습', '창업 아이디어 탐색', 'AI 제품 탐색'],
  },
  {
    id: 'content_preference',
    title: '어떤 콘텐츠를 더 자주 받고 싶나요?',
    type: 'multi',
    options: ['짧은 요약', '깊이 있는 분석', '프로젝트 아이디어', '논문 리뷰', '오픈소스 추천', 'AI 제품 추천'],
  },
  {
    id: 'newsletter_frequency',
    title: '뉴스레터는 얼마나 자주 받고 싶나요?',
    type: 'single',
    options: ['매일', '주 2-3회', '주 1회', '중요한 것만'],
  },
] as const;

export type OnboardingAnswers = Record<string, string | string[]>;
