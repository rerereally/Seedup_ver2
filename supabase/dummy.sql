-- Seedup dummy data for backend/UI testing
-- Run this after supabase/schema.sql.
-- This file inserts public content only. User-owned scraps require an auth.users id.

insert into public.news_items
  (title, summary, content, category, source, source_url, image_url, project_idea, published_at)
values
  (
    'Next.js App Router 캐싱 전략 변화',
    '서버 컴포넌트와 라우트 캐시의 기본 동작이 바뀌면서 데이터 갱신 전략을 더 명확히 설계해야 합니다.',
    'Next.js App Router를 사용하는 팀은 페이지별 데이터 갱신 주기를 먼저 정해야 합니다. 정적인 마케팅 페이지, 실시간성이 필요한 대시보드, 사용자별 개인화 페이지는 각각 다른 캐시 전략을 가져야 합니다.\n\n초보자 프로젝트에서는 뉴스 목록, 상세 페이지, 저장 목록을 나눠 구현해보면 서버 렌더링과 클라이언트 상호작용의 경계를 익히기 좋습니다.',
    'Web',
    'Vercel Blog',
    'https://nextjs.org',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=80',
    'RSC 기반 뉴스 큐레이션 대시보드',
    now() - interval '2 hours'
  ),
  (
    'AI Agent가 개발 워크플로우를 바꾸는 방식',
    '이슈 분석, 코드 변경 제안, PR 설명 작성까지 이어지는 에이전트형 개발 도구가 빠르게 확산되고 있습니다.',
    'AI Agent는 단순한 챗봇이 아니라 목표를 여러 단계로 나누고 실행 결과를 다시 평가하는 소프트웨어 패턴입니다.\n\n개발자 입장에서는 반복적인 리서치, 이슈 분류, 테스트 작성, 문서화 작업을 자동화하는 작은 에이전트를 만드는 것이 좋은 시작점입니다.',
    'AI Agent',
    'Seedup Research',
    'https://example.com/ai-agent-workflow',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80',
    'GitHub 이슈 자동 분류 봇',
    now() - interval '5 hours'
  ),
  (
    'Supabase Edge Functions로 백엔드 자동화하기',
    'DB 이벤트와 서버리스 함수를 결합하면 뉴스 수집, 요약, 알림 같은 백엔드 작업을 작게 시작할 수 있습니다.',
    'Supabase는 Postgres, Auth, Storage, Edge Functions를 한 번에 제공하기 때문에 MVP 백엔드로 적합합니다.\n\nSeedup 같은 서비스에서는 news_items에 원문을 저장하고, Edge Function에서 요약과 프로젝트 아이디어를 생성하는 구조로 확장할 수 있습니다.',
    'Backend',
    'Supabase Blog',
    'https://supabase.com',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&q=80',
    '뉴스 수집 및 요약 파이프라인',
    now() - interval '1 day'
  ),
  (
    '로컬 LLM을 활용한 개인 지식 검색',
    '프라이버시와 비용을 고려하는 팀들이 로컬 모델 기반 문서 검색 워크플로우를 실험하고 있습니다.',
    '로컬 LLM은 외부 API 비용을 낮추고 민감한 문서를 외부로 보내지 않는 장점이 있습니다.\n\n작은 프로젝트에서는 PDF나 마크다운 문서를 업로드하고, 임베딩 검색과 로컬 모델 답변을 연결하는 흐름을 구현해볼 수 있습니다.',
    'Local AI',
    'Open Source Weekly',
    'https://example.com/local-llm-search',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=80',
    '개인 문서 Q&A 앱',
    now() - interval '2 days'
  ),
  (
    'CSS Container Queries 실전 적용 사례',
    '컴포넌트가 자신의 컨테이너 크기에 반응하면서 복잡한 반응형 레이아웃을 더 안정적으로 만들 수 있습니다.',
    'Container Queries는 페이지 전체 viewport가 아니라 컴포넌트가 놓인 영역을 기준으로 스타일을 바꿀 수 있게 해줍니다.\n\n카드, 사이드바, 대시보드 위젯처럼 재사용되는 UI를 만들 때 특히 유용합니다.',
    'Frontend',
    'CSS Tricks',
    'https://example.com/container-queries',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80',
    '반응형 카드 컴포넌트 갤러리',
    now() - interval '3 days'
  );

insert into public.trends
  (rank, keyword, summary, score, status, bars, project_ideas)
values
  (
    1,
    'AI Agent',
    '단순 질의응답을 넘어 사용자의 목표를 여러 단계로 쪼개고 실행하는 에이전트 제품이 주목받고 있습니다.',
    94,
    'Hot',
    array[30, 45, 58, 72, 86, 94],
    array['GitHub 이슈 자동 분류 봇', '개인 업무 리서치 에이전트']
  ),
  (
    2,
    'Local LLM',
    '데이터 프라이버시와 비용 절감을 위해 로컬에서 구동되는 경량 모델과 Ollama 기반 워크플로우가 확산 중입니다.',
    88,
    'Rising',
    array[22, 34, 43, 57, 73, 88],
    array['오프라인 문서 Q&A', '로컬 코드 리뷰 도우미']
  ),
  (
    3,
    'React Server Components',
    '서버 컴포넌트가 실전 프로젝트 기본 패턴으로 자리 잡으면서 데이터 페칭과 렌더링 설계가 바뀌고 있습니다.',
    82,
    'Stable',
    array[51, 58, 64, 70, 78, 82],
    array['RSC 블로그 템플릿', '서버 컴포넌트 대시보드']
  ),
  (
    4,
    'DevSecOps',
    '보안 검증과 의존성 점검을 개발 파이프라인 안에 넣는 팀이 늘어나고 있습니다.',
    76,
    'Watch',
    array[38, 42, 49, 55, 68, 76],
    array['SBOM 리포트 뷰어', 'PR 보안 체크 대시보드']
  );

insert into public.ai_products
  (name, category, description, score, rating_count, status, website_url)
values
  (
    'Cursor',
    '개발자 도구',
    '코드베이스를 이해하고 수정 제안까지 제공하는 AI 코드 에디터입니다.',
    9.7,
    12800,
    'Hot',
    'https://cursor.com'
  ),
  (
    'Perplexity',
    'AI 검색',
    '출처 기반 답변과 실시간 웹 검색을 결합한 리서치 도구입니다.',
    9.3,
    9400,
    'Rising',
    'https://perplexity.ai'
  ),
  (
    'v0',
    'UI 생성',
    '프롬프트에서 React UI 초안을 빠르게 생성하는 제품 빌드 도구입니다.',
    9.1,
    7100,
    'New',
    'https://v0.dev'
  ),
  (
    'Claude',
    'LLM Chat',
    '긴 문맥 이해와 코드 설명에 강한 대화형 AI 어시스턴트입니다.',
    9.0,
    11200,
    'Stable',
    'https://claude.ai'
  );

insert into public.project_ideas
  (title, description, level, duration_days, stack, related_trend, plan)
values
  (
    'AI 뉴스 요약 및 번역 에이전트',
    '해외 개발 뉴스를 수집하고 초보자가 이해하기 쉬운 한국어 요약으로 바꿔주는 자동화 프로젝트입니다.',
    '초급',
    7,
    array['Next.js', 'Supabase', 'OpenAI API', 'Vercel'],
    'AI Agent',
    array[
      '뉴스 데이터 구조와 화면 흐름 설계',
      'Next.js App Router 프로젝트 세팅',
      'Supabase news_items 테이블 연결',
      '요약 프롬프트와 API route 작성',
      '뉴스 목록과 상세 페이지 연결',
      '로딩, 빈 상태, 에러 상태 다듬기',
      '배포와 README 작성'
    ]
  ),
  (
    '개인 문서 Q&A 앱',
    'PDF나 마크다운 문서를 저장하고 질문하면 관련 내용을 찾아 답변하는 지식 검색 앱입니다.',
    '중급',
    7,
    array['Next.js', 'Supabase Storage', 'pgvector', 'Local LLM'],
    'Local LLM',
    array[
      '문서 업로드 UX 설계',
      'Supabase Storage 연결',
      '텍스트 추출 및 chunk 구조 정의',
      '임베딩 저장 테이블 설계',
      '검색 API 구현',
      '답변 UI와 출처 표시',
      '샘플 문서로 QA 테스트'
    ]
  ),
  (
    'RSC 제품 랭킹 대시보드',
    '서버 컴포넌트로 AI 제품 데이터를 가져오고 랭킹, 필터, 상세 페이지를 제공하는 대시보드입니다.',
    '초급',
    5,
    array['Next.js', 'React Server Components', 'Supabase'],
    'React Server Components',
    array[
      '랭킹 데이터 스키마 확정',
      '서버 컴포넌트 데이터 조회',
      '랭킹 리스트 UI 구현',
      '상세 페이지 연결',
      '필터와 정렬 UX 정리'
    ]
  ),
  (
    'PR 보안 체크 대시보드',
    '의존성 변경, 위험 파일, 보안 체크 결과를 한 화면에 보여주는 개발팀용 대시보드입니다.',
    '고급',
    10,
    array['Next.js', 'GitHub API', 'Supabase', 'Edge Functions'],
    'DevSecOps',
    array[
      'GitHub App 권한 범위 설계',
      'PR 이벤트 수집 구조 설계',
      '보안 체크 결과 테이블 작성',
      '위험도 점수 계산 로직 구현',
      '대시보드 카드와 필터 구현',
      '알림 정책 연결',
      '테스트 리포트 작성'
    ]
  );

-- Optional: create scraps for the currently logged-in user.
-- Replace the UUID below with an auth.users.id from Supabase Dashboard.
--
-- insert into public.scraps
--   (user_id, item_type, title, description, tag)
-- values
--   ('00000000-0000-0000-0000-000000000000', 'news', 'Next.js App Router 캐싱 전략 변화', '나중에 프로젝트로 연결할 뉴스', 'Web'),
--   ('00000000-0000-0000-0000-000000000000', 'project', 'AI 뉴스 요약 및 번역 에이전트', '7일 빌드 플랜으로 진행할 프로젝트', 'AI Agent');
