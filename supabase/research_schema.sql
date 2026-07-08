-- Seedup research paper review schema
-- Run this in Supabase SQL Editor if research_papers / news_paper_links are missing.

create extension if not exists pgcrypto;

create table if not exists public.research_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  abstract text,
  authors text[] default '{}',
  source text,
  source_url text,
  paper_url text not null,
  pdf_url text,
  code_url text,
  categories text[] default '{}',
  review_type text,
  beginner_summary text,
  expert_summary text,
  why_it_matters text,
  key_points text[] default '{}',
  related_skills text[] default '{}',
  implementation_idea text,
  service_idea text,
  difficulty text,
  target_reader text,
  relevance_score integer,
  trend_score integer,
  buildability_score integer,
  beginner_score integer,
  business_score integer,
  research_depth_score integer,
  has_code boolean not null default false,
  is_huggingface_trending boolean not null default false,
  ai_model text,
  processed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_paper_links (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_items(id) on delete cascade,
  paper_id uuid not null references public.research_papers(id) on delete cascade,
  relevance_reason text,
  relevance_score integer,
  created_at timestamptz not null default now(),
  constraint news_paper_links_news_id_paper_id_key unique (news_id, paper_id)
);

alter table public.research_papers enable row level security;
alter table public.news_paper_links enable row level security;

grant select on public.research_papers to anon, authenticated;
grant select on public.news_paper_links to anon, authenticated;
grant select, insert, update, delete on public.research_papers to service_role;
grant select, insert, update, delete on public.news_paper_links to service_role;

drop policy if exists "Research papers are publicly readable" on public.research_papers;
create policy "Research papers are publicly readable"
  on public.research_papers for select
  using (true);

drop policy if exists "News paper links are publicly readable" on public.news_paper_links;
create policy "News paper links are publicly readable"
  on public.news_paper_links for select
  using (true);

drop index if exists research_papers_paper_url_key;
create unique index research_papers_paper_url_key on public.research_papers (paper_url);
create index if not exists research_papers_relevance_idx on public.research_papers (relevance_score desc, published_at desc);
create index if not exists research_papers_review_type_idx on public.research_papers (review_type, relevance_score desc);
create index if not exists news_paper_links_news_idx on public.news_paper_links (news_id, relevance_score desc);

notify pgrst, 'reload schema';
