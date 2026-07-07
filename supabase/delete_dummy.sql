-- Remove only the local dummy/seed data inserted by supabase/dummy.sql and supabase/seed.sql.
-- Run this after verifying the real RSS/Product Hunt/GitHub ingestion works.

delete from public.project_ideas
where title in (
  'AI 뉴스 요약 및 번역 에이전트',
  '개인 문서 Q&A 앱',
  'RSC 제품 랭킹 대시보드',
  'PR 보안 체크 대시보드'
);

delete from public.ai_products
where name in (
  'Cursor',
  'Perplexity',
  'v0',
  'Claude',
  'Nexus AI'
);

delete from public.trends
where keyword in (
  'AI Agent',
  'Local LLM',
  'React Server Components',
  'DevSecOps'
);

delete from public.news_items
where title in (
  'Next.js App Router 캐싱 전략 변화',
  'AI Agent가 개발 워크플로우를 바꾸는 방식',
  'Supabase Edge Functions로 백엔드 자동화하기',
  '로컬 LLM을 활용한 개인 지식 검색',
  'CSS Container Queries 실전 적용 사례',
  'Next.js 서버 컴포넌트 패턴 변화'
);

-- Optional cleanup if Product Hunt was ingested into news_items before it was separated
-- into ai_products. Uncomment only if you want to remove those old mixed rows.
--
-- delete from public.news_items
-- where source = 'Product Hunt';
