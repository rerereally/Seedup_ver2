export const onboardingQuestions = [
  {
    id: 'experience_period',
    title: '현재 개발 수준은 어디에 가장 가까운가요?',
    type: 'single',
    options: ['완전 처음', '입문자', '초보자', '중급자', '실무 경험 있음'],
  },
  {
    id: 'completion_level',
    title: '혼자서 프로그램을 끝까지 만들어본 경험이 있나요?',
    type: 'single',
    options: ['없음', '있음'],
    followUp: {
      id: 'built_programs',
      placeholder: '예: 투두 앱, 디스코드 봇, 크롤러, 게임, 자동화 스크립트',
    },
  },
  {
    id: 'tech_stack',
    title: '사용해본 기술을 선택해주세요.',
    type: 'multi',
    options: ['HTML/CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Svelte', 'Node.js', 'Express', 'Python', 'Django/FastAPI', 'Java', 'Spring', 'C/C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Supabase/Firebase', 'PostgreSQL/MySQL', 'MongoDB', 'OpenAI/Gemini API', 'LangChain/RAG', 'Docker', 'AWS/GCP/Cloudflare', 'Git/GitHub', 'Figma'],
  },
  {
    id: 'strong_area',
    title: '관심 있는 개발 영역을 선택해주세요.',
    type: 'multi',
    options: ['프론트엔드', '백엔드', '풀스택', 'AI/API 연동', '데이터/DB', '모바일', '디자인/UI', 'DevOps/배포', '오픈소스', '아직 잘 모르겠음'],
  },
  {
    id: 'interests',
    title: '어떤 프로젝트를 만들고 싶나요?',
    type: 'multi',
    options: ['AI 도구', '생산성 앱', '개발자 도구', '뉴스/콘텐츠 서비스', '커뮤니티', '커머스', '데이터 대시보드', '모바일 친화 웹앱', '자동화 봇', '학습/교육 서비스', 'B2B SaaS'],
  },
  {
    id: 'goal',
    title: 'Seedup을 쓰는 가장 큰 목적은 무엇인가요?',
    type: 'multi',
    options: ['맞춤 뉴스레터 구독', '개발 트렌드 빠르게 파악', '포트폴리오 만들기', '취업/이직 준비', '사이드 프로젝트', '창업 아이디어 검증', 'AI 제품 탐색', '논문 쉽게 이해하기', '최신 기술 공부', '팀 프로젝트 주제 찾기', '오픈소스 프로젝트 찾기'],
  },
  {
    id: 'content_preference',
    title: '어떤 콘텐츠를 더 자주 받고 싶나요?',
    type: 'multi',
    options: ['초보자용 해설', '실무 트렌드', 'AI 제품 분석', 'GitHub 오픈소스 리뷰', '논문 쉽게 읽기', '프로젝트 튜토리얼', '취업 포트폴리오 팁', '창업/제품 아이디어'],
  },
  {
    id: 'newsletter_depth',
    title: '뉴스레터 설명 깊이는 어느 정도가 좋나요?',
    type: 'single',
    options: ['짧고 쉽게', '핵심과 예시 중심', '기술 배경까지 자세히', '실무 적용 관점으로 깊게'],
  },
  {
    id: 'build_style',
    title: '프로젝트를 만들 때 어떤 방식이 편한가요?',
    type: 'single',
    options: ['따라하기 튜토리얼', '체크리스트', '직접 설계하며 만들기', '오픈소스 분석 후 응용하기'],
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
    options: ['아주 쉬움', '조금 도전적', '어렵지만 성장할 수 있는 것', '실무 수준으로 빡세게'],
  },
  {
    id: 'avoid_topics',
    title: '너무 어렵거나 피하고 싶은 주제가 있나요?',
    type: 'multi',
    options: ['수학 많은 AI 논문', '복잡한 인프라', '블록체인', '하드웨어/IoT', '디자인 중심 작업', '없음', '기타'],
    followUp: {
      id: 'avoid_topics_other',
      placeholder: '피하고 싶은 주제가 있다면 적어주세요.',
    },
  },
] as const;

export type OnboardingAnswers = Record<string, string | string[]>;
