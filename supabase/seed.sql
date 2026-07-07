-- Optional seed data for local visual testing.
-- Skip this file if you want a completely empty production database.

insert into public.news_items (title, summary, content, category, source, project_idea)
values
  ('Next.js 서버 컴포넌트 패턴 변화', '서버와 클라이언트 경계가 더 명확해지고 있습니다.', '본문 내용을 입력하세요.', 'Web', 'Seedup', 'RSC 뉴스 큐레이션 대시보드');

insert into public.trends (rank, keyword, summary, score, status, bars, project_ideas)
values
  (1, 'AI Agent', '사용자의 목표를 여러 단계로 쪼개고 실행하는 에이전트 제품이 주목받고 있습니다.', 94, 'Hot', array[30,45,58,72,86,94], array['이슈 자동 분류 봇', '개인 업무 리서치 에이전트']);

insert into public.ai_products (name, category, description, score, rating_count, status)
values
  ('Nexus AI', '생산성', '업무 자동화를 위한 올인원 AI 어시스턴트입니다.', 9.8, 4200, 'Hot');

insert into public.project_ideas (title, description, level, duration_days, stack, related_trend, plan)
values
  ('AI 뉴스 요약 및 번역 에이전트', '해외 개발 뉴스를 수집하고 한국어로 요약하는 자동화 프로젝트입니다.', '초급', 7, array['Next.js', 'Supabase', 'OpenAI API'], 'AI Agent', array['문제 정의와 화면 설계', 'Next.js 프로젝트 세팅', '뉴스 수집 API 연결', 'AI 요약 프롬프트 작성', '결과 저장과 목록 UI', '반응형/빈 상태 다듬기', '배포와 README 작성']);
