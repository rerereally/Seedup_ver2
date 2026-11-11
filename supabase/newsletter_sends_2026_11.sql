-- One row per mail issue per person, written before sending, so the same issue is never mailed twice.
-- Safe to run more than once.

create table if not exists public.newsletter_sends (
  id bigint generated always as identity primary key,
  kind text not null,
  period_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (kind, period_key, user_id)
);

create index if not exists newsletter_sends_sent_at_idx on public.newsletter_sends (sent_at desc);

-- No policies on purpose: only the service key, used by the server and the scheduled job, reads or writes this.
alter table public.newsletter_sends enable row level security;
