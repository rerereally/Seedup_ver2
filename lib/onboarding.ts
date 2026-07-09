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
  {
    id: 'newsletter_frequency',
    title: '뉴스레터는 얼마나 자주 받고 싶나요?',
    type: 'single',
    options: ['매일', '주 2~3회', '주 1회', '중요한 소식만', '아직 모르겠음'],
  },
] as const;

export type OnboardingAnswers = Record<string, string | string[]>;
