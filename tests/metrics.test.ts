import assert from 'node:assert/strict';
import test from 'node:test';
import { usageFunnel } from '../lib/metrics';
import { missingSchema, schemaFromMigrations, SCHEMA_FILES } from '../lib/schema-check';

test('the usage funnel counts people per step inside the window, and a second active day as returning', () => {
  const since = '2026-11-10T00:00:00.000Z';
  const funnel = usageFunnel({
    onboarding: [{ user_id: 'a', created_at: '2026-11-11T01:00:00Z' }, { user_id: 'old', created_at: '2026-10-01T01:00:00Z' }],
    scraps: [{ user_id: 'a', created_at: '2026-11-11T02:00:00Z' }, { user_id: 'a', created_at: '2026-11-11T03:00:00Z' }],
    prdRuns: [
      { user_id: 'a', created_at: '2026-11-12T01:00:00Z', ok: true, kind: 'prd', duration_ms: 30_000 },
      { user_id: 'b', created_at: '2026-11-12T01:00:00Z', ok: false, kind: 'prd', duration_ms: 90_000 },
      { user_id: 'b', created_at: '2026-11-12T02:00:00Z', ok: true, kind: 'revise', duration_ms: 5_000 },
    ],
    dossiers: [{ user_id: 'a', created_at: '2026-11-12T01:05:00Z' }],
    tokens: [{ user_id: 'a', created_at: '2026-11-01T00:00:00Z', last_used_at: '2026-11-13T00:00:00Z' }, { user_id: 'c', created_at: '2026-11-01T00:00:00Z', last_used_at: null }],
    usage: [],
  }, since);
  assert.equal(funnel.signedUp, 1);
  assert.equal(funnel.kept, 1);
  // Two scraps count one person; only full PRD runs count toward PRD made and the success rate.
  assert.equal(funnel.prdMade, 1);
  assert.equal(funnel.prdRuns, 2);
  assert.equal(funnel.prdSuccessRate, 50);
  assert.equal(funnel.prdMedianSeconds, 30);
  assert.equal(funnel.prdSaved, 1);
  assert.equal(funnel.agentUsed, 1);
  assert.equal(funnel.agentConnected, 2);
  // a: active on the 11th, 12th and 13th; b: only the 12th.
  assert.equal(funnel.active, 2);
  assert.equal(funnel.returning, 1);
});

test('the schema check names the SQL file for each missing table, column or function', () => {
  const spec = { paths: { '/mcp_tokens': {}, '/evidence_dossiers': {}, '/rpc/release_ai_usage': {} }, definitions: { evidence_dossiers: { properties: { id: {} } } } };
  const gaps = missingSchema(spec, [
    { file: 'a.sql', tables: ['mcp_tokens'] },
    { file: 'b.sql', tables: ['prd_runs'], functions: ['release_ai_usage', 'consume_ai_usage'] },
    { file: 'c.sql', columns: [['evidence_dossiers', 'shared']] },
  ]);
  assert.deepEqual(gaps, [{ file: 'b.sql', missing: ['prd_runs', 'consume_ai_usage()'] }, { file: 'c.sql', missing: ['evidence_dossiers.shared'] }]);
});

test('the schema check reads tables, columns and functions from migrations, and forgets what a later one drops', () => {
  const files = schemaFromMigrations([
    {
      file: '1_init.sql',
      sql: `-- it's a comment with a quote; create table public.not_real (x int);
        create table if not exists public.notes (id uuid primary key default gen_random_uuid(), body text not null default 'a, b; c', tags text[] default '{}', constraint body_len check (length(body) < 10), unique (body));
        create table auth.other (id uuid);
        alter table public.notes enable row level security;
        create or replace function public.touch() returns trigger language plpgsql as $$ begin new.body := 'x;'; return new; end $$;
        create or replace function public.count_notes(p text) returns int language sql as $fn$ select 1; $fn$;`,
    },
    { file: '2_more.sql', sql: 'alter table public.notes add column if not exists shared boolean not null default false, add column old text, add constraint c unique (old);' },
    { file: '3_drop.sql', sql: 'alter table public.notes drop column if exists old; drop function if exists public.count_notes(text);' },
  ]);
  assert.deepEqual(files, [
    { file: '1_init.sql', tables: ['notes'], columns: [['notes', 'id'], ['notes', 'body'], ['notes', 'tags']] },
    { file: '2_more.sql', columns: [['notes', 'shared']] },
  ]);
  // The real migrations parse, and every file that adds something is listed in the committed manifest.
  assert.ok(SCHEMA_FILES.some((entry) => entry.tables?.includes('evidence_dossiers')));
});

import { evalSummary } from '../lib/opportunities/eval';

test('the PRD evaluation summary counts only returned PRDs for issues and time, and only problem cases for citations', () => {
  const summary = evalSummary([
    { id: 'p1', kind: 'problem', ok: true, seconds: 40, issues: 0, requirements: 4, cited: 3, firstIssue: '' },
    { id: 'p2', kind: 'problem', ok: true, seconds: 60, issues: 2, requirements: 4, cited: 1, firstIssue: 'R1' },
    { id: 'p3', kind: 'problem', ok: false, seconds: 95, issues: 0, requirements: 0, cited: 0, firstIssue: '' },
    { id: 'i1', kind: 'idea', ok: true, seconds: 30, issues: 1, requirements: 5, cited: 0, firstIssue: 'M' },
  ]);
  assert.deepEqual(summary, { total: 4, ok: 3, successRate: 75, clean: 1, meanIssues: 1, medianSeconds: 40, citedShare: 50 });
});

import { recentReleases, releaseNote } from '../lib/ingest/kept-repos';

test('release notes keep the first lines that say something, without headings, links or badges', () => {
  const body = "## What's Changed\n![badge](https://x/y.svg)\n* Add **streaming** support to the [client](https://x)\n* Fix memory leak in worker pool\n\n**Full Changelog**: https://github.com/a/b/compare/v1...v2";
  assert.equal(releaseNote(body), 'Add streaming support to the client Fix memory leak in worker pool');
  assert.equal(releaseNote(null), '');
  assert.ok(releaseNote('x'.repeat(500)).length <= 200);
});

test('recent releases keep the last 30 days, newest first', () => {
  const now = new Date('2026-11-18T00:00:00Z').getTime();
  const row = (id: string, at: string | null) => ({ id, latest_release: at ? { tag: 'v1', name: 'v1', url: 'u', publishedAt: at, note: '' } : null });
  assert.deepEqual(recentReleases([row('old', '2026-09-01T00:00:00Z'), row('a', '2026-11-01T00:00:00Z'), row('none', null), row('b', '2026-11-17T00:00:00Z')], 30, now).map((item) => item.id), ['b', 'a']);
});
