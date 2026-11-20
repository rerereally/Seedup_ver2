-- Quotes found on the web for someone's idea, shared so the next person with a similar idea starts from them instead
-- of searching again. Every row passed the word-for-word check against its public post when it was found. No user id
-- and no idea text are stored: only the quote, its public source, and the search words that found it.
-- Read and written by the server (service role) only. Safe to run more than once.
create table if not exists public.found_evidence (
  id text primary key check (id like 'lv\_%'),
  platform text not null,
  quote text not null check (char_length(quote) between 12 and 400),
  quote_ko text not null default '',
  url text not null,
  score integer not null default 0,
  posted_at timestamptz,
  terms text[] not null default '{}',
  found_count integer not null default 1,
  first_found_at timestamptz not null default now(),
  last_found_at timestamptz not null default now()
);

create index if not exists found_evidence_terms_idx on public.found_evidence using gin (terms);

alter table public.found_evidence enable row level security;
revoke all on public.found_evidence from anon, authenticated;
grant select, insert, update, delete on public.found_evidence to service_role;

-- Adds or refreshes found quotes in one call: a quote found again keeps its first date, gains the new search words,
-- and counts how often it was found.
create or replace function public.save_found_evidence(p_rows jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.found_evidence as f (id, platform, quote, quote_ko, url, score, posted_at, terms)
  select r.id, r.platform, r.quote, coalesce(r.quote_ko, ''), r.url, coalesce(r.score, 0), r.posted_at, coalesce(r.terms, '{}')
  from jsonb_to_recordset(p_rows) as r(id text, platform text, quote text, quote_ko text, url text, score integer, posted_at timestamptz, terms text[])
  on conflict (id) do update set
    terms = (select array(select distinct t from unnest(f.terms || excluded.terms) as t limit 40)),
    score = greatest(f.score, excluded.score),
    found_count = f.found_count + 1,
    last_found_at = now();
$$;

revoke all on function public.save_found_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.save_found_evidence(jsonb) to service_role;

-- Daily limits for visitors who are not signed in, keyed by a salted hash of their address (never the address).
create table if not exists public.anon_usage (
  visitor text not null,
  feature text not null,
  usage_date date not null default current_date,
  count integer not null default 0,
  primary key (visitor, feature, usage_date)
);

alter table public.anon_usage enable row level security;
revoke all on public.anon_usage from anon, authenticated;
grant select, insert, update, delete on public.anon_usage to service_role;

create or replace function public.consume_anon_usage(p_visitor text, p_feature text, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if coalesce(p_visitor, '') = '' then
    return false;
  end if;

  insert into public.anon_usage (visitor, feature, count)
  values (p_visitor, p_feature, 1)
  on conflict (visitor, feature, usage_date)
  do update set count = public.anon_usage.count + 1
  returning count into v_count;

  return v_count <= p_daily_limit;
end;
$$;

create or replace function public.release_anon_usage(p_visitor text, p_feature text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.anon_usage set count = greatest(count - 1, 0)
  where visitor = p_visitor and feature = p_feature and usage_date = current_date;
$$;

revoke all on function public.consume_anon_usage(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_anon_usage(text, text) from public, anon, authenticated;
grant execute on function public.consume_anon_usage(text, text, integer) to service_role;
grant execute on function public.release_anon_usage(text, text) to service_role;
