-- Human review rules for published opportunities: hide a problem that does not belong, or drop an off-topic verbatim
-- quote. Read and written only with the service key so admins can update reviews from /admin/ingest without redeploying.
create table if not exists public.opportunity_reviews (
  slug text not null,
  kind text not null check (kind in ('hide', 'drop_quote')),
  quote text not null default '',
  reason text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  primary key (slug, kind, quote)
);

-- Service key only: no policy means anon and authenticated roles cannot read or write directly.
alter table public.opportunity_reviews enable row level security;
revoke all on public.opportunity_reviews from anon, authenticated;
grant select, insert, update, delete on public.opportunity_reviews to service_role;

insert into public.opportunity_reviews (slug, kind, quote, reason, created_by)
values
  ('milvus-missing-now-function', 'hide', '', 'a feature request only Milvus itself can ship', 'seed'),
  ('better-auth-prisma-next-adapter', 'hide', '', 'a compatibility request for one library, fixed by its maintainers', 'seed'),
  ('ai-latex-rendering-error', 'hide', '', 'each quote is a rendering bug in a different product', 'seed'),
  ('kagi-mcp-server-missing', 'hide', '', 'a request for one vendor, and 9 direct rivals already exist', 'seed'),
  ('positive-ai-developer-community', 'hide', '', 'an opinion about a community, not a problem software solves', 'seed'),
  ('gpu-rental-price-arbitrage', 'hide', '', 'a price comparison and a wish to trade, not a pain', 'seed'),
  ('international-meeting-time-zone-sync', 'hide', '', 'everyday complaints about time zones, a space crowded with mature tools', 'seed'),
  ('agent-workflow-control', 'drop_quote', 'This has been raised repeatedly by the community for over 7 months with no acknowledgment from the Anthropic team', 'filed under wrong problem', 'seed'),
  ('ai-agent-guardrails', 'drop_quote', 'WHEN ASKED TO REBOOT A SERVER IT WENT BACK ON THE SERVER', 'filed under wrong problem', 'seed'),
  ('ai-agent-guardrails', 'drop_quote', 'I wish I could give the agent some more autonomy.', 'filed under wrong problem', 'seed'),
  ('llm-provider-schema-normalization', 'drop_quote', 'Amazon Bedrock does not provide an API that returns:', 'filed under wrong problem', 'seed'),
  ('database-cli-inconsistent-commands', 'drop_quote', 'manually inspecting payloads would not be quick and easy w/o some custom tooling', 'filed under wrong problem', 'seed'),
  ('distributed-sqlite-concurrent-writes', 'drop_quote', 'with an EFS volume for database storage. I never experience errors, but when upgrading', 'filed under wrong problem', 'seed')
on conflict (slug, kind, quote) do nothing;
