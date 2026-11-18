-- Validation kit: a public page for one idea with a waitlist, so a builder can count real sign-ups before building.
-- Run once in the Supabase SQL editor.
create table if not exists public.idea_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]{10}$'),
  idea text not null check (char_length(idea) between 4 and 300),
  headline text not null check (char_length(headline) between 4 and 120),
  pitch text not null default '' check (char_length(pitch) <= 600),
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.idea_pages(id) on delete cascade,
  email text not null check (char_length(email) between 5 and 200),
  created_at timestamptz not null default now(),
  unique (page_id, email)
);

alter table public.idea_pages enable row level security;
alter table public.waitlist_signups enable row level security;

drop policy if exists "idea_pages_own" on public.idea_pages;
create policy "idea_pages_own" on public.idea_pages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Sign-ups are written by the server and read only by the page owner.
drop policy if exists "waitlist_owner_select" on public.waitlist_signups;
create policy "waitlist_owner_select" on public.waitlist_signups for select to authenticated using (exists (select 1 from public.idea_pages p where p.id = page_id and p.user_id = auth.uid()));
drop policy if exists "waitlist_owner_delete" on public.waitlist_signups;
create policy "waitlist_owner_delete" on public.waitlist_signups for delete to authenticated using (exists (select 1 from public.idea_pages p where p.id = page_id and p.user_id = auth.uid()));

grant select, insert, update, delete on public.idea_pages to authenticated;
grant select, delete on public.waitlist_signups to authenticated;
grant select, insert, update, delete on public.idea_pages, public.waitlist_signups to service_role;
