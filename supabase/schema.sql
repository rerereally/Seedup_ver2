-- Seedup Supabase schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text,
  category text,
  source text,
  source_url text,
  original_url text,
  raw_title text,
  raw_content text,
  image_url text,
  project_idea text,
  ai_summary text,
  beginner_summary text,
  why_it_matters text,
  key_points text[] default '{}',
  related_skills text[] default '{}',
  difficulty text,
  relevance_score integer,
  ai_model text,
  processed_at timestamptz,
  source_language text,
  target_levels text[] default '{}',
  target_goals text[] default '{}',
  target_interests text[] default '{}',
  content_depth text,
  published_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.trends (
  id uuid primary key default gen_random_uuid(),
  rank integer,
  keyword text not null,
  summary text,
  score integer check (score is null or (score >= 0 and score <= 100)),
  status text,
  bars integer[] default '{}',
  project_ideas text[] default '{}',
  sources_count integer default 0,
  news_count integer default 0,
  github_repo_count integer default 0,
  product_count integer default 0,
  source_refs jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.keyword_signals (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  normalized_keyword text not null,
  source_type text not null check (source_type in ('news', 'product', 'github')),
  source_id uuid not null,
  source_title text not null,
  source_url text,
  weight numeric(8, 2) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  snapshot_date date not null default current_date,
  score integer not null default 0,
  signal_count integer not null default 0,
  news_count integer not null default 0,
  product_count integer not null default 0,
  github_repo_count integer not null default 0,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null check (status in ('success', 'partial', 'failed')),
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  duration_ms integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  score numeric(3, 1),
  rating_count integer default 0,
  status text,
  website_url text,
  source text,
  product_hunt_url text,
  launch_date timestamptz,
  use_cases text[] default '{}',
  pricing_type text,
  target_user text,
  related_project_ideas text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.project_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  level text,
  duration_days integer default 7,
  stack text[] default '{}',
  related_trend text,
  source_type text,
  source_id uuid,
  target_user_level text,
  recommended_for text[] default '{}',
  portfolio_value text,
  plan text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.scraps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('news', 'paper', 'project', 'idea', 'trend', 'ai_product', 'github')),
  item_id uuid,
  title text not null,
  description text,
  tag text,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  idea_text text not null,
  status text not null default 'pending',
  score integer check (score is null or (score >= 0 and score <= 100)),
  result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.github_trends (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null unique,
  repo_url text not null,
  description text,
  stars integer default 0,
  forks integer default 0,
  language text,
  topics text[] default '{}',
  pushed_at timestamptz,
  ai_review text,
  beginner_summary text,
  project_idea text,
  relevance_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  target_levels text[] default '{}',
  target_goals text[] default '{}',
  target_interests text[] default '{}',
  content_depth text,
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

create table if not exists public.content_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('news', 'paper', 'github', 'project', 'ai_product')),
  item_id uuid not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_reactions_user_item_key unique (user_id, item_type, item_id)
);

create table if not exists public.ai_product_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.ai_products(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_product_ratings_user_product_key unique (user_id, product_id)
);

create table if not exists public.user_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  answers jsonb not null default '{}'::jsonb,
  newsletter_subscribed boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_onboarding_user_id_key unique (user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.news_items enable row level security;
alter table public.trends enable row level security;
alter table public.keyword_signals enable row level security;
alter table public.trend_snapshots enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.ai_products enable row level security;
alter table public.project_ideas enable row level security;
alter table public.scraps enable row level security;
alter table public.idea_evaluations enable row level security;
alter table public.user_onboarding enable row level security;
alter table public.github_trends enable row level security;
alter table public.research_papers enable row level security;
alter table public.news_paper_links enable row level security;
alter table public.content_reactions enable row level security;
alter table public.ai_product_ratings enable row level security;

alter table public.news_items add column if not exists original_url text;
alter table public.news_items add column if not exists raw_title text;
alter table public.news_items add column if not exists raw_content text;
alter table public.news_items add column if not exists ai_summary text;
alter table public.news_items add column if not exists beginner_summary text;
alter table public.news_items add column if not exists why_it_matters text;
alter table public.news_items add column if not exists key_points text[] default '{}';
alter table public.news_items add column if not exists related_skills text[] default '{}';
alter table public.news_items add column if not exists difficulty text;
alter table public.news_items add column if not exists relevance_score integer;
alter table public.news_items add column if not exists ai_model text;
alter table public.news_items add column if not exists processed_at timestamptz;
alter table public.news_items add column if not exists source_language text;
alter table public.news_items add column if not exists target_levels text[] default '{}';
alter table public.news_items add column if not exists target_goals text[] default '{}';
alter table public.news_items add column if not exists target_interests text[] default '{}';
alter table public.news_items add column if not exists content_depth text;
alter table public.news_items add column if not exists view_count integer not null default 0;
alter table public.news_items add column if not exists like_count integer not null default 0;
alter table public.news_items add column if not exists dislike_count integer not null default 0;
alter table public.trends add column if not exists sources_count integer default 0;
alter table public.trends add column if not exists news_count integer default 0;
alter table public.trends add column if not exists github_repo_count integer default 0;
alter table public.trends add column if not exists product_count integer default 0;
alter table public.trends add column if not exists source_refs jsonb default '[]'::jsonb;
alter table public.keyword_signals add column if not exists normalized_keyword text;
alter table public.keyword_signals add column if not exists source_url text;
alter table public.keyword_signals add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_products add column if not exists source text;
alter table public.ai_products add column if not exists product_hunt_url text;
alter table public.ai_products add column if not exists launch_date timestamptz;
alter table public.ai_products add column if not exists use_cases text[] default '{}';
alter table public.ai_products add column if not exists pricing_type text;
alter table public.ai_products add column if not exists target_user text;
alter table public.ai_products add column if not exists related_project_ideas text[] default '{}';
alter table public.ai_products add column if not exists view_count integer not null default 0;
alter table public.ai_products add column if not exists like_count integer not null default 0;
alter table public.ai_products add column if not exists dislike_count integer not null default 0;
alter table public.ai_products add column if not exists user_score_sum integer not null default 0;
alter table public.research_papers add column if not exists code_url text;
alter table public.research_papers add column if not exists review_type text;
alter table public.research_papers add column if not exists beginner_summary text;
alter table public.research_papers add column if not exists expert_summary text;
alter table public.research_papers add column if not exists why_it_matters text;
alter table public.research_papers add column if not exists key_points text[] default '{}';
alter table public.research_papers add column if not exists related_skills text[] default '{}';
alter table public.research_papers add column if not exists implementation_idea text;
alter table public.research_papers add column if not exists service_idea text;
alter table public.research_papers add column if not exists difficulty text;
alter table public.research_papers add column if not exists target_reader text;
alter table public.research_papers add column if not exists trend_score integer;
alter table public.research_papers add column if not exists buildability_score integer;
alter table public.research_papers add column if not exists beginner_score integer;
alter table public.research_papers add column if not exists business_score integer;
alter table public.research_papers add column if not exists research_depth_score integer;
alter table public.research_papers add column if not exists target_levels text[] default '{}';
alter table public.research_papers add column if not exists target_goals text[] default '{}';
alter table public.research_papers add column if not exists target_interests text[] default '{}';
alter table public.research_papers add column if not exists content_depth text;
alter table public.research_papers add column if not exists has_code boolean not null default false;
alter table public.research_papers add column if not exists is_huggingface_trending boolean not null default false;
alter table public.research_papers add column if not exists ai_model text;
alter table public.research_papers add column if not exists processed_at timestamptz;
alter table public.research_papers add column if not exists view_count integer not null default 0;
alter table public.research_papers add column if not exists like_count integer not null default 0;
alter table public.research_papers add column if not exists dislike_count integer not null default 0;
alter table public.project_ideas add column if not exists source_type text;
alter table public.project_ideas add column if not exists source_id uuid;
alter table public.project_ideas add column if not exists target_user_level text;
alter table public.project_ideas add column if not exists recommended_for text[] default '{}';
alter table public.project_ideas add column if not exists portfolio_value text;
alter table public.project_ideas add column if not exists view_count integer not null default 0;
alter table public.project_ideas add column if not exists like_count integer not null default 0;
alter table public.project_ideas add column if not exists dislike_count integer not null default 0;
alter table public.scraps drop constraint if exists scraps_item_type_check;
alter table public.scraps add constraint scraps_item_type_check check (item_type in ('news', 'paper', 'project', 'idea', 'trend', 'ai_product', 'github'));
alter table public.github_trends add column if not exists view_count integer not null default 0;
alter table public.github_trends add column if not exists like_count integer not null default 0;
alter table public.github_trends add column if not exists dislike_count integer not null default 0;

grant usage on schema public to anon, authenticated, service_role;

grant select on public.news_items to anon, authenticated;
grant select on public.trends to anon, authenticated;
grant select on public.keyword_signals to anon, authenticated;
grant select on public.trend_snapshots to anon, authenticated;
grant select on public.ingest_runs to authenticated;
grant select on public.ai_products to anon, authenticated;
grant select on public.project_ideas to anon, authenticated;
grant select on public.github_trends to anon, authenticated;
grant select on public.research_papers to anon, authenticated;
grant select on public.news_paper_links to anon, authenticated;
grant select on public.content_reactions to authenticated;
grant select on public.ai_product_ratings to authenticated;

grant select, insert, update, delete on public.news_items to service_role;
grant select, insert, update, delete on public.trends to service_role;
grant select, insert, update, delete on public.keyword_signals to service_role;
grant select, insert, update, delete on public.trend_snapshots to service_role;
grant select, insert, update, delete on public.ingest_runs to service_role;
grant select, insert, update, delete on public.ai_products to service_role;
grant select, insert, update, delete on public.project_ideas to service_role;
grant select, insert, update, delete on public.github_trends to service_role;
grant select, insert, update, delete on public.research_papers to service_role;
grant select, insert, update, delete on public.news_paper_links to service_role;
grant select, insert, update, delete on public.idea_evaluations to service_role;
grant select, insert, update, delete on public.user_onboarding to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.scraps to service_role;
grant select, insert, update, delete on public.content_reactions to service_role;
grant select, insert, update, delete on public.ai_product_ratings to service_role;

grant select, insert, delete on public.scraps to authenticated;
grant select, insert, update, delete on public.content_reactions to authenticated;
grant select, insert, update on public.ai_product_ratings to authenticated;
grant select, insert on public.idea_evaluations to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_onboarding to authenticated;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Published content is publicly readable" on public.news_items;
create policy "Published content is publicly readable"
  on public.news_items for select
  using (true);

drop policy if exists "Trends are publicly readable" on public.trends;
create policy "Trends are publicly readable"
  on public.trends for select
  using (true);

drop policy if exists "Keyword signals are publicly readable" on public.keyword_signals;
create policy "Keyword signals are publicly readable"
  on public.keyword_signals for select
  using (true);

drop policy if exists "Trend snapshots are publicly readable" on public.trend_snapshots;
create policy "Trend snapshots are publicly readable"
  on public.trend_snapshots for select
  using (true);

drop policy if exists "Authenticated users can read ingest runs" on public.ingest_runs;
create policy "Authenticated users can read ingest runs"
  on public.ingest_runs for select
  using (auth.role() = 'authenticated');

drop policy if exists "AI products are publicly readable" on public.ai_products;
create policy "AI products are publicly readable"
  on public.ai_products for select
  using (true);

drop policy if exists "Project ideas are publicly readable" on public.project_ideas;
create policy "Project ideas are publicly readable"
  on public.project_ideas for select
  using (true);

drop policy if exists "GitHub trends are publicly readable" on public.github_trends;
create policy "GitHub trends are publicly readable"
  on public.github_trends for select
  using (true);

drop policy if exists "Research papers are publicly readable" on public.research_papers;
create policy "Research papers are publicly readable"
  on public.research_papers for select
  using (true);

drop policy if exists "News paper links are publicly readable" on public.news_paper_links;
create policy "News paper links are publicly readable"
  on public.news_paper_links for select
  using (true);

drop policy if exists "Users can read own content reactions" on public.content_reactions;
create policy "Users can read own content reactions"
  on public.content_reactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own content reactions" on public.content_reactions;
create policy "Users can create own content reactions"
  on public.content_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own content reactions" on public.content_reactions;
create policy "Users can update own content reactions"
  on public.content_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own content reactions" on public.content_reactions;
create policy "Users can delete own content reactions"
  on public.content_reactions for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own AI product ratings" on public.ai_product_ratings;
create policy "Users can read own AI product ratings"
  on public.ai_product_ratings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own AI product ratings" on public.ai_product_ratings;
create policy "Users can create own AI product ratings"
  on public.ai_product_ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own AI product ratings" on public.ai_product_ratings;
create policy "Users can update own AI product ratings"
  on public.ai_product_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own scraps" on public.scraps;
create policy "Users can read own scraps"
  on public.scraps for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own scraps" on public.scraps;
create policy "Users can create own scraps"
  on public.scraps for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own scraps" on public.scraps;
create policy "Users can delete own scraps"
  on public.scraps for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own idea evaluations" on public.idea_evaluations;
create policy "Users can read own idea evaluations"
  on public.idea_evaluations for select
  using (auth.uid() = user_id);

drop policy if exists "Anyone can create pending idea evaluations" on public.idea_evaluations;
drop policy if exists "Anyone can create idea evaluations" on public.idea_evaluations;
create policy "Anyone can create idea evaluations"
  on public.idea_evaluations for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can read own onboarding" on public.user_onboarding;
create policy "Users can read own onboarding"
  on public.user_onboarding for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own onboarding" on public.user_onboarding;
create policy "Users can create own onboarding"
  on public.user_onboarding for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own onboarding" on public.user_onboarding;
create policy "Users can update own onboarding"
  on public.user_onboarding for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

delete from public.news_items
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by original_url
        order by coalesce(published_at, created_at) desc, created_at desc
      ) as duplicate_rank
    from public.news_items
    where original_url is not null
  ) duplicates
  where duplicate_rank > 1
);

delete from public.trends
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by keyword
        order by coalesce(rank, 999999) asc, created_at desc
      ) as duplicate_rank
    from public.trends
  ) duplicates
  where duplicate_rank > 1
);

delete from public.ai_products
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by product_hunt_url
        order by created_at desc
      ) as duplicate_rank
    from public.ai_products
    where product_hunt_url is not null
  ) duplicates
  where duplicate_rank > 1
);

delete from public.project_ideas
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by source_type, source_id, title
        order by created_at desc
      ) as duplicate_rank
    from public.project_ideas
    where source_type is not null and source_id is not null
  ) duplicates
  where duplicate_rank > 1
);

delete from public.scraps
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, item_type, item_id
        order by created_at desc
      ) as duplicate_rank
    from public.scraps
    where item_id is not null
  ) duplicates
  where duplicate_rank > 1
);

create index if not exists news_items_published_at_idx on public.news_items (published_at desc);
drop index if exists news_items_original_url_key;
create unique index news_items_original_url_key on public.news_items (original_url);
create unique index if not exists trends_keyword_key on public.trends (keyword);
create index if not exists trends_rank_idx on public.trends (rank asc);
create unique index if not exists keyword_signals_source_key on public.keyword_signals (source_type, source_id, normalized_keyword);
create index if not exists keyword_signals_detected_idx on public.keyword_signals (detected_at desc);
create index if not exists keyword_signals_keyword_idx on public.keyword_signals (normalized_keyword, detected_at desc);
create unique index if not exists trend_snapshots_keyword_date_key on public.trend_snapshots (keyword, snapshot_date);
create index if not exists trend_snapshots_date_score_idx on public.trend_snapshots (snapshot_date desc, score desc);
create index if not exists ingest_runs_created_idx on public.ingest_runs (created_at desc);
create index if not exists ingest_runs_source_created_idx on public.ingest_runs (source, created_at desc);
create index if not exists ai_products_score_idx on public.ai_products (score desc);
drop index if exists ai_products_product_hunt_url_key;
create unique index ai_products_product_hunt_url_key on public.ai_products (product_hunt_url);
drop index if exists project_ideas_source_key;
create unique index project_ideas_source_key on public.project_ideas (source_type, source_id, title);
create index if not exists scraps_user_created_idx on public.scraps (user_id, created_at desc);
create unique index if not exists scraps_user_item_key on public.scraps (user_id, item_type, item_id) where item_id is not null;
create index if not exists content_reactions_user_item_idx on public.content_reactions (user_id, item_type, item_id);
create index if not exists content_reactions_item_idx on public.content_reactions (item_type, item_id);
create index if not exists ai_product_ratings_product_idx on public.ai_product_ratings (product_id);
create index if not exists user_onboarding_user_idx on public.user_onboarding (user_id);
create index if not exists github_trends_stars_idx on public.github_trends (stars desc);
drop index if exists research_papers_paper_url_key;
create unique index research_papers_paper_url_key on public.research_papers (paper_url);
create index if not exists research_papers_relevance_idx on public.research_papers (relevance_score desc, published_at desc);
create index if not exists research_papers_review_type_idx on public.research_papers (review_type, relevance_score desc);
create index if not exists news_paper_links_news_idx on public.news_paper_links (news_id, relevance_score desc);
