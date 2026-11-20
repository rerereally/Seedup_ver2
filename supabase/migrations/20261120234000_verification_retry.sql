-- A failed verification can be claimed once more for the same immutable commit.
alter table public.verifications add column if not exists retried boolean not null default false;
