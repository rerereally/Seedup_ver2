import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { saveDossierUsage, summarizeProjectUsage, uploadAgentUsage, type UsageRow } from '../lib/db/agent-usage';
import { hashToken } from '../lib/mcp/auth';
import type { BuildProgress, BuildProgressHistory, FeatureStatus } from '../lib/opportunities/build-progress';
import { prdRunLog } from '../lib/opportunities/prd-runs';
import { priceFor, tokenCost, TOP_MODEL } from '../lib/pricing';
import { hookBundle } from '../lib/supervisor/hook-bundle';

const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const project = 'reminders';
const session = '11111111-1111-1111-1111-111111111111';
const token = `sdp_${'b'.repeat(48)}`;
const at = (minute: number) => `2026-11-21T00:${String(minute).padStart(2, '0')}:00.000000Z`;
const usage = (minute: number, model = 'claude-haiku-5-5', input_tokens = 1000): UsageRow => ({
  ts: at(minute), model, input_tokens, output_tokens: 100,
});

test('PRD runs still log to the old schema without issuing a claim key', async () => {
  const inserts: Record<string, unknown>[] = [];
  const service = createClient('https://db.invalid', 'service', { global: { fetch: async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/rest/v1/prd_runs');
    inserts.push(JSON.parse(String(init?.body)));
    return inserts.length === 1
      ? Response.json({ code: 'PGRST204', message: "Could not find the 'run_key' column of 'prd_runs' in the schema cache" }, { status: 400 })
      : new Response(null, { status: 201 });
  } } });
  assert.equal(await prdRunLog(service, { id: user }, 'prd', 'openai/gpt-6.2-sol').finish(true, 'Example'), undefined);
  assert.equal(inserts.length, 2);
  assert.ok(inserts[0].run_key);
  for (const key of ['run_key', 'project_key', 'cost_complete']) assert.equal(Object.hasOwn(inserts[1], key), false);
  assert.equal(inserts[1].user_id, user);
});

test('runs with a resolved project key are attributed without another dossier save', async () => {
  const projectKey = `prd:${session}`;
  let logged: Record<string, unknown> | undefined;
  const service = createClient('https://db.invalid', 'service', { global: { fetch: async (_url, init) => {
    logged = JSON.parse(String(init?.body));
    return new Response(null, { status: 201 });
  } } });
  const key = await prdRunLog(service, { id: user }, 'revise', 'openai/gpt-6.2-sol').finish(true, 'Example', undefined, projectKey);
  assert.ok(key);
  assert.equal(logged?.run_key, key);
  assert.equal(logged?.user_id, user);
  assert.equal(logged?.project_key, projectKey);
});

test('usage upload checks token ownership and quota, and repeated batches append only new rows', async () => {
  const stored = new Map<string, Record<string, unknown>>();
  let calls = 0;
  let limit = true;
  let loseAck = true;
  const service = createClient('https://db.invalid', 'service', { global: { fetch: async (url, init) => {
    const request = new URL(String(url));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    switch (request.pathname) {
      case '/rest/v1/mcp_tokens':
        if (init?.method === 'PATCH') {
          assert.equal(request.searchParams.get('user_id'), `eq.${user}`);
          return new Response(null, { status: 204 });
        }
        return Response.json(request.searchParams.get('token_hash') === `eq.${hashToken(token)}` ? [{ user_id: user }] : []);
      case '/rest/v1/supervisor_projects':
        assert.equal(request.searchParams.get('user_id'), `eq.${user}`);
        return Response.json(request.searchParams.get('project_key') === `eq.${project}` ? [{ project_key: project }] : []);
      case '/rest/v1/rpc/consume_ai_usage_for':
        calls++;
        assert.deepEqual(body, { p_user: user, p_feature: 'agent_usage', p_daily_limit: 500 });
        return Response.json(limit);
      case '/rest/v1/agent_usage': {
        const cols = request.searchParams.get('on_conflict')!.split(',');
        assert.deepEqual(cols, ['user_id', 'source', 'session_id', 'ts', 'model']);
        assert.match(new Headers(init?.headers).get('prefer') ?? '', /resolution=ignore-duplicates/);
        for (const row of body) {
          assert.equal(row.user_id, user);
          assert.equal(row.project_key, project);
          const key = cols.map((col) => row[col]).join('/');
          if (!stored.has(key)) stored.set(key, row);
        }
        if (loseAck) {
          loseAck = false;
          return Response.json({ message: 'lost acknowledgement' }, { status: 503 });
        }
        return new Response(null, { status: 201 });
      }
      default: throw new Error(request.pathname);
    }
  } } });
  const first = usage(1);
  const payload = { project, session_id: session, source: 'codex', rows: [first, { ...first, ts: '2026-11-21T09:01:00+09:00', input_tokens: 99 }] };
  const upload = (body: unknown, bearer = token) => uploadAgentUsage(new Request('https://seedup.invalid/api/usage', {
    method: 'POST', headers: { authorization: `Bearer ${bearer}` }, body: JSON.stringify(body),
  }), service);
  assert.equal((await upload(payload, `sdp_${'c'.repeat(48)}`)).status, 401);
  assert.equal((await upload({ ...payload, project: 'another-project' })).status, 404);
  for (const invalid of [
    { ...payload, user_id: user }, { ...payload, rows: [{ ...first, content: 'private' }] },
    { ...payload, rows: [{ ...first, model: '/private/file' }] }, { ...payload, rows: [{ ...first, output_tokens: -1 }] },
  ]) assert.equal((await upload(invalid)).status, 400);
  assert.equal(calls, 0);
  assert.equal((await upload(payload)).status, 503);
  assert.equal(stored.size, 1);
  assert.equal((await upload({ ...payload, rows: [{ ...first, input_tokens: 99 }, usage(2)] })).status, 200);
  assert.equal(stored.size, 2);
  assert.equal([...stored.values()][0].input_tokens, first.input_tokens);
  limit = false;
  assert.equal((await upload({ ...payload, rows: [usage(3)] })).status, 429);
  assert.equal(stored.size, 2);
  assert.equal(calls, 3);
});

test('migration restricts usage reads to the owner and writes and PRD attribution to service role', () => {
  const sql = readFileSync(join(__dirname, '../supabase/migrations/20261121080000_agent_usage.sql'), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select to authenticated\s+using \(\(select auth.uid\(\)\) = user_id\)/i);
  assert.match(sql, /revoke all on public.agent_usage from public, anon, authenticated/i);
  assert.match(sql, /grant select on public.agent_usage to authenticated/i);
  assert.match(sql, /grant select, insert on public.agent_usage to service_role/i);
  assert.match(sql, /primary key \(user_id, source, session_id, ts, model\)/i);
  assert.match(sql, /foreign key \(user_id, project_key\) references public.supervisor_projects\(user_id, project_key\)/i);
  assert.match(sql, /where user_id = p_user_id and ok and project_key is null and run_key = any\(p_run_keys\)/i);
  assert.match(sql, /revoke all on function public.save_dossier_with_usage\([^)]*\) from public, anon, authenticated/i);
});

test('dossier save sends only explicit, deduplicated run keys to its owner-scoped transaction', async () => {
  const row = { dossier_key: 'x', prd_markdown: '# Saved' };
  let called = false;
  const service = createClient('https://db.invalid', 'service', { global: { fetch: async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/rest/v1/rpc/save_dossier_with_usage');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      p_user_id: user, p_dossier: row, p_run_keys: [session], p_project_slug: null, p_draft_id: null,
    });
    called = true;
    return Response.json('22222222-2222-2222-2222-222222222222');
  } } });
  const result = await saveDossierUsage(service, user, row, [session, session, 'invalid'], null, null, service);
  assert.equal(called, true);
  assert.equal(result.data?.id, '22222222-2222-2222-2222-222222222222');
});

test('feature windows handle overlap, reopens and completion boundaries, and criteria sum linked features', () => {
  const event = (minute: number, status: FeatureStatus) => ({ id: String(minute), status, note: '', createdAt: at(minute) });
  const history: BuildProgressHistory = {
    'F-01': [event(7, 'done'), event(6, 'in_progress'), event(4, 'done'), event(2, 'improving'), event(1, 'in_progress')],
    'F-02': [event(5, 'done'), event(3, 'in_progress')],
    'F-03': [event(9, 'in_progress')],
  };
  const rows = [usage(0), usage(1), usage(2), usage(3), usage(4, 'unknown-model'), usage(5), usage(6), usage(9), usage(10)];
  const summary = summarizeProjectUsage(rows, history, {}, [{ id: 'G-1', text: 'goal', measure: '', status: 'open', featureIds: ['F-01', 'F-02', 'F-01'] }], [
    { prompt_tokens: 200, completion_tokens: 100, cost_usd: 0.03, cost_complete: true },
  ], [
    { input_tokens: 400, output_tokens: 100, cost_usd: 0.02, model: 'model' },
    { input_tokens: 50, output_tokens: 50, cost_usd: 0, model: 'model' },
  ], Date.parse(at(10)));
  const features = new Map(summary.features.map((row) => [row.id, row.total]));
  assert.equal(features.get('F-01')?.tokens, 3300);
  assert.equal(features.get('F-02')?.unpriced, 1);
  assert.equal(features.get('F-03')?.tokens, 1100);
  assert.equal(summary.criteria[0].total.tokens, 4400);
  assert.equal(summary.unmapped.tokens, 4400);
  assert.equal(summary.seedup.tokens, 900);
  assert.equal(summary.seedup.unpriced, 1);
  assert.equal(summary.seedup.cost, 0.05);
  assert.equal(summary.total.tokens, 10_800);
  const cost = tokenCost('claude-haiku-5-5', rows[1])!;
  const baseline = tokenCost(TOP_MODEL, rows[1])!;
  assert.ok(Math.abs(features.get('F-01')!.savings - 3 * (baseline - cost)) < 1e-12);
  assert.equal(tokenCost('unknown-model', rows[0]), null);
  assert.equal(tokenCost('example:free', rows[0]), 0);
  assert.equal(priceFor('constructor'), null);
  assert.equal(tokenCost('claude-haiku-5-5', { input_tokens: 100_001, output_tokens: 0 }), 0.0500005);
});

test('only three distinct comparable supervisor-verified features unlock a recommendation', () => {
  const history: BuildProgressHistory = {};
  const progress: BuildProgress = {};
  for (let i = 0; i < 4; i++) {
    const id = `F-0${i + 1}`;
    const event = (minute: number, status: FeatureStatus) => ({ id, status, note: '', createdAt: at(minute) });
    history[id] = [event(i * 3, 'in_progress'), event(i * 3 + 2, 'done')];
    progress[id] = { status: 'done', verificationLevel: 'supervisor_verified', title: id, note: '', updatedAt: at(i * 3 + 2), doneAt: at(i * 3 + 2) };
  }
  const rows = [usage(1, 'claude-opus-5-5', 800), usage(4), usage(7), usage(10)];
  const recommendation = () => summarizeProjectUsage(rows, history, progress, [], [], []).features[0].tier;
  assert.equal(recommendation(), 'Haiku');
  progress['F-04'].verificationLevel = 'local_checked';
  assert.equal(recommendation(), undefined);
  progress['F-04'].verificationLevel = 'supervisor_verified';
  rows[3].input_tokens = 500;
  assert.equal(recommendation(), undefined);
});

test('generated collectors read fake JSONL, keep content and paths local, and checkpoint only successful uploads', (t) => {
  const sandbox = mkdtempSync(join(tmpdir(), 'seedup-usage-'));
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));
  const root = join(sandbox, 'private-worktree');
  const scripts = join(root, '.seedup');
  const logs = join(sandbox, 'sessions', '2026', '11');
  const script = join(scripts, 'usage.mjs');
  const recorded = join(sandbox, 'requests.jsonl');
  const mock = join(sandbox, 'mock.mjs');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(logs, { recursive: true });
  const files = hookBundle(project, { projectKey: project, statement: 'a goal', version: 1, track: 'personal', criteria: [], inScope: [], outOfScope: [], changeReason: null, lockedAt: at(0) });
  assert.ok(!JSON.stringify(files).includes(token));
  writeFileSync(script, files.find((file) => file.path === '.seedup/usage.mjs')!.content);
  writeFileSync(mock, `import { appendFileSync } from 'node:fs';
    globalThis.fetch = async (url, init) => {
      if (url.pathname !== '/api/usage' || init.redirect !== 'manual' || init.method !== 'POST' || init.headers.authorization !== 'Bearer ' + process.env.SEEDUP_USAGE_TOKEN) throw Error('invalid upload');
      appendFileSync(${JSON.stringify(recorded)}, init.body + '\\n');
      return { ok: !process.env.FIXTURE_UPLOAD_FAIL };
    };`);
  const run = (agent: string, input = '', overrides: Record<string, string> = {}) => spawnSync(process.execPath, ['--import', mock, script, agent], {
    input, encoding: 'utf8',
    env: { ...process.env, ...(process.platform === 'win32' ? { USERPROFILE: sandbox } : { HOME: sandbox }), CODEX_HOME: sandbox, SEEDUP_USAGE_TOKEN: token, ...overrides },
  });
  const readUploads = () => readFileSync(recorded, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const transcript = join(sandbox, 'private-transcript.jsonl');
  const assistant = (minute: number, id: string, output_tokens: number) => ({
    type: 'assistant', timestamp: at(minute), sessionId: session, cwd: root,
    message: { id, model: 'claude-haiku-5-5', content: 'PRIVATE CODE', usage: { input_tokens: 10, output_tokens, cache_read_input_tokens: 3, cache_creation_input_tokens: 5 } },
  });
  const jsonl = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
  writeFileSync(transcript, jsonl([{ type: 'user', content: 'PRIVATE CHAT' }, assistant(1, 'reply1', 1), assistant(2, 'reply1', 2)]));
  const input = JSON.stringify({ transcript_path: transcript, session_id: session, cwd: root, last_assistant_message: 'PRIVATE CHAT' });
  assert.equal(run('claude-code', input, { SEEDUP_USAGE_TOKEN: '' }).status, 0);
  assert.throws(() => readFileSync(recorded), { code: 'ENOENT' });
  assert.equal(run('claude-code', input, { FIXTURE_UPLOAD_FAIL: '1' }).status, 1);
  assert.equal(run('claude-code', input).status, 0);
  assert.equal(run('claude-code', input).status, 0);
  assert.equal(readUploads().length, 2);
  assert.deepEqual(readUploads()[0], readUploads()[1]);
  assert.deepEqual(readUploads()[1], {
    project, source: 'claude_code', session_id: session,
    rows: [{ ts: at(1), model: 'claude-haiku-5-5', input_tokens: 10, output_tokens: 2, cache_read_tokens: 3, cache_write_tokens: 5 }],
  });
  appendFileSync(transcript, jsonl([assistant(3, 'reply2', 3)]));
  assert.equal(run('claude-code', input).status, 0);
  assert.deepEqual(readUploads()[2].rows.map((row: UsageRow) => row.ts), [at(3)]);

  const turn = (cwd: string, model: string) => ({ type: 'turn_context', payload: { cwd, model } });
  const counts = (minute: number, input_tokens: number, output_tokens: number, cached_input_tokens: number, cache_write_input_tokens: number) => ({
    type: 'event_msg', timestamp: at(minute),
    payload: { type: 'token_count', info: { total_token_usage: { input_tokens, output_tokens, cached_input_tokens, cache_write_input_tokens, reasoning_output_tokens: 1 } } },
  });
  writeFileSync(join(logs, 'rollout-fixture.jsonl'), jsonl([
    { type: 'session_meta', payload: { id: session, cwd: root } }, turn(root, 'gpt-6.2-sol'),
    { type: 'response_item', payload: { code: 'PRIVATE CODE', path: root } },
    counts(1, 100, 20, 30, 40), counts(2, 100, 20, 30, 40),
    turn(sandbox, 'gpt-6.2-sol'), counts(3, 200, 40, 60, 80),
    turn(root, 'future-model'), counts(4, 240, 46, 70, 80),
  ]) + '{partial');
  assert.equal(run('codex').status, 0);
  assert.equal(run('codex').status, 0);
  const uploads = readUploads();
  assert.equal(uploads.length, 4);
  assert.deepEqual(uploads[3], { project, source: 'codex', session_id: session, rows: [
    { ts: at(1), model: 'gpt-6.2-sol', input_tokens: 30, output_tokens: 20, cache_read_tokens: 30, cache_write_tokens: 40 },
    { ts: at(4), model: 'future-model', input_tokens: 30, output_tokens: 6, cache_read_tokens: 10, cache_write_tokens: 0 },
  ] });
  for (const forbidden of ['PRIVATE CHAT', 'PRIVATE CODE', root, transcript, token, 'reply1']) assert.ok(!JSON.stringify(uploads).includes(forbidden));
});
