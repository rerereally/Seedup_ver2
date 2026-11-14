-- One personal MCP token per user. Only its SHA-256 hash is stored; the token itself is shown once.
create table if not exists public.mcp_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- No policies on purpose: only the server (service role) reads and writes it.
alter table public.mcp_tokens enable row level security;
revoke all on public.mcp_tokens from anon, authenticated;
grant select, insert, update, delete on public.mcp_tokens to service_role;
