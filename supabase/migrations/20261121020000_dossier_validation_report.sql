-- The validation report validate_idea (MCP) made for an idea draft, so the supervisor page can show it later instead of
-- only in the agent's chat: the markdown the agent got, the verdict level and when it was made. Written by the server
-- (service role) only; rows keep the table's existing owner policies. Safe to run more than once.
alter table public.evidence_dossiers add column if not exists validation_report jsonb;
