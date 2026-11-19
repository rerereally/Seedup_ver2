-- Sentences a person saved from a post (from the browser extension), each checked against the post when saved.
-- Run once in the Supabase SQL editor.
create table if not exists public.saved_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  quote text not null check (char_length(quote) between 12 and 400),
  platform text not null default 'web',
  page_title text,
  created_at timestamptz not null default now(),
  unique (user_id, url, quote)
);

alter table public.saved_quotes enable row level security;

drop policy if exists "saved_quotes_own_select" on public.saved_quotes;
create policy "saved_quotes_own_select" on public.saved_quotes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "saved_quotes_own_delete" on public.saved_quotes;
create policy "saved_quotes_own_delete" on public.saved_quotes for delete to authenticated using (auth.uid() = user_id);

grant select, delete on public.saved_quotes to authenticated;
grant select, insert, update, delete on public.saved_quotes to service_role;
