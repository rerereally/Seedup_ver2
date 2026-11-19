-- Owners can make one saved PRD readable by anyone with its link (read-only, served by the server).
alter table public.evidence_dossiers add column if not exists shared boolean not null default false;
