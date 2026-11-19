-- Opportunity engine, saved evidence dossiers, and per-user AI usage limits.
-- Safe to run more than once.

create table if not exists public.opportunities (
  slug text primary key,
  data jsonb not null,
  embedding jsonb,
  qualified boolean not null default false,
  status text not null default 'unknown',
  generated_at timestamptz not null default now(),
  published boolean not null default true
);

create index if not exists opportunities_published_idx on public.opportunities (published, qualified desc, generated_at desc);

alter table public.opportunities enable row level security;
drop policy if exists "Published opportunities are public" on public.opportunities;
create policy "Published opportunities are public" on public.opportunities
  for select using (published);

-- One row per engine run, kept forever, so status changes can be shown as a track record.
create table if not exists public.opportunity_history (
  id bigint generated always as identity primary key,
  slug text not null,
  generated_at timestamptz not null,
  status text not null,
  qualified boolean not null default false,
  evidence_count integer not null default 0,
  direct_count integer not null default 0,
  followers_after_signal integer not null default 0
);

create index if not exists opportunity_history_slug_idx on public.opportunity_history (slug, generated_at desc);

alter table public.opportunity_history enable row level security;
drop policy if exists "Opportunity history is public" on public.opportunity_history;
create policy "Opportunity history is public" on public.opportunity_history
  for select using (true);

create table if not exists public.evidence_dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dossier_key text not null,
  title text not null,
  opportunity_slug text,
  evidence_ids text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  prd_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dossier_key)
);

alter table public.evidence_dossiers enable row level security;
drop policy if exists "Users manage their own dossiers" on public.evidence_dossiers;
create policy "Users manage their own dossiers" on public.evidence_dossiers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  usage_date date not null default (now() at time zone 'Asia/Seoul')::date,
  count integer not null default 0,
  primary key (user_id, feature, usage_date)
);

-- No policies on purpose: rows are only reachable through consume_ai_usage below.
alter table public.ai_usage enable row level security;

create or replace function public.consume_ai_usage(p_feature text, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  insert into public.ai_usage (user_id, feature, count)
  values (v_user, p_feature, 1)
  on conflict (user_id, feature, usage_date)
  do update set count = public.ai_usage.count + 1
  returning count into v_count;

  return v_count <= p_daily_limit;
end;
$$;

revoke all on function public.consume_ai_usage(text, integer) from public, anon;
grant execute on function public.consume_ai_usage(text, integer) to authenticated;
