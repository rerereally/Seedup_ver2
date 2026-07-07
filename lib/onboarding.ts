export const onboardingQuestions = [
  {
    id: 'experience_period',
    title: '개발을 시작한 지 얼마나 됐나요?',
    type: 'single',
    options: ['처음 시작', '1~3개월', '3~6개월', '6개월~1년', '1년 이상'],
  },
  {
    id: 'completion_level',
    title: '혼자서 웹앱을 끝까지 만들어본 경험은 어느 정도인가요?',
    type: 'single',
    options: ['없음', '튜토리얼 따라 해봄', '간단한 CRUD 가능', '배포까지 해봄', '실제 사용자 있는 서비스 경험 있음'],
  },
  {
    id: 'tech_stack',
    title: '사용해본 기술을 선택해주세요.',
    type: 'multi',
    options: ['HTML/CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Supabase/Firebase', 'SQL', 'OpenAI/Gemini API'],
  },
  {
    id: 'strong_area',
    title: '가장 자신 있는 영역은 무엇인가요?',
    type: 'single',
    options: ['프론트엔드', '백엔드', 'AI/API 연동', '데이터/DB', '디자인/UI', '아직 잘 모르겠음'],
  },
  {
    id: 'interests',
    title: '어떤 프로젝트를 만들고 싶나요?',
    type: 'multi',
    options: ['AI 도구', '생산성 앱', '개발자 도구', '뉴스/콘텐츠 서비스', '커뮤니티', '커머스', '데이터 대시보드', '모바일 친화 웹앱'],
  },
  {
    id: 'goal',
    title: 'Seedup을 쓰는 가장 큰 목적은 무엇인가요?',
    type: 'single',
    options: ['포트폴리오 만들기', '취업/이직 준비', '사이드 프로젝트', '창업 아이디어 검증', '최신 기술 공부', '팀 프로젝트 주제 찾기'],
  },
  {
    id: 'weekly_time',
    title: '일주일에 투자 가능한 시간은 어느 정도인가요?',
    type: 'single',
    options: ['1~3시간', '4~7시간', '8~14시간', '15시간 이상'],
  },
  {
    id: 'difficulty',
    title: '원하는 프로젝트 난이도는?',
    type: 'single',
    options: ['아주 쉬움', '조금 도전적', '어렵지만 성장할 수 있는 것'],
  },
] as const;

export type OnboardingAnswers = Record<string, string | string[]>;
