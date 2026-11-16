-- One row per weekly issue, the version for everyone, so the site can show past issues (the web archive).
-- Written by the weekly mail job even when mail is not configured yet. Safe to run more than once.

create table if not exists public.newsletter_issues (
  period_key text primary key,
  subject text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- No policies on purpose: the server reads it with the service key and renders the archive.
alter table public.newsletter_issues enable row level security;
revoke all on public.newsletter_issues from anon, authenticated;
grant select, insert, update, delete on public.newsletter_issues to service_role;
