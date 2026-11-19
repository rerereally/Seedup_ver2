-- Public PRD list (/spec): an owner who shares a PRD can also list it, so anyone can browse it and start their own from
-- the same quotes. A row shows only while both shared and listed are true; turning sharing off also unlists it.
alter table public.evidence_dossiers add column if not exists listed boolean not null default false;
create index if not exists evidence_dossiers_listed_idx on public.evidence_dossiers (updated_at desc) where shared and listed;
