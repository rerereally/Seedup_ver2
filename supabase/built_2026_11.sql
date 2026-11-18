-- "I built this": the link and a short note an owner adds to a saved PRD. Shown publicly only when the PRD is shared.
-- Run once in the Supabase SQL editor.
alter table public.evidence_dossiers add column if not exists built_url text;
alter table public.evidence_dossiers add column if not exists built_note text;
alter table public.evidence_dossiers add column if not exists built_at timestamptz;
