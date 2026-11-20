import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { lockProjectGoal, readGoalInput } from '../lib/db/project-goals';
import { addProjectMemory } from '../lib/db/project-memory';
import { resolveProjectKey } from '../lib/db/supervisor-projects';

const USER = '00000000-0000-0000-0000-00000000000a';
const DOSSIER = 'abcdef00-2222-3333-4444-555555555555';
const service = createClient('https://supabase.invalid', 'test-secret-key', { auth: { persistSession: false } });

/** Answers Supabase REST calls with `reply(url, body)`, as one object when the client asked for one. */
function supabase(t: TestContext, reply: (url: URL, body: unknown) => { status?: number; json: unknown }) {
  return t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input);
    const { status = 200, json } = reply(url, init.body ? JSON.parse(String(init.body)) : null);
    const single = new Headers(init.headers).get('accept')?.includes('vnd.pgrst.object');
    return Response.json(single && Array.isArray(json) ? json[0] ?? null : json, { status });
  });
}

const valid = {
  track: 'personal',
  statement: ' 혼자 쓰는 가계부를 매일 1분 안에 정리한다 ',
  criteria: [
    { id: 'G-2', text: '하루 기록이 1분 안에 끝난다', measure: '기록 시작부터 저장까지 시간', status: 'met' },
    { text: '월말 합계가 은행 잔고와 맞는다', measure: '3개월 대조', status: 'nope' },
  ],
  inScope: ['기록', '월별 합계'],
  outOfScope: ['다른 사람과 공유'],
};

test('a goal body is trimmed, keeps G-n ids and numbers new criteria after them', () => {
  assert.deepEqual(readGoalInput(valid), {
    goal: {
      track: 'personal',
      statement: '혼자 쓰는 가계부를 매일 1분 안에 정리한다',
      criteria: [
        { id: 'G-2', text: '하루 기록이 1분 안에 끝난다', measure: '기록 시작부터 저장까지 시간', status: 'met' },
        { id: 'G-3', text: '월말 합계가 은행 잔고와 맞는다', measure: '3개월 대조', status: 'open' },
      ],
      inScope: ['기록', '월별 합계'],
      outOfScope: ['다른 사람과 공유'],
      changeReason: null,
    },
  });
  const duplicate = readGoalInput({ ...valid, criteria: [valid.criteria[0], { ...valid.criteria[0] }], changeReason: ' 범위 축소 ' });
  assert.ok('goal' in duplicate);
  assert.deepEqual(duplicate.goal.criteria.map((row) => row.id), ['G-2', 'G-3']);
  assert.equal(duplicate.goal.changeReason, '범위 축소');
});

test('a goal body is refused when a field is missing, out of range or the wrong type', () => {
  const refused = (body: unknown) => 'error' in readGoalInput(body);
  assert.ok(refused(null));
  assert.ok(refused({ ...valid, track: 'team' }));
  assert.ok(refused({ ...valid, statement: '   ' }));
  assert.ok(refused({ ...valid, statement: 'a'.repeat(501) }));
  assert.ok(refused({ ...valid, criteria: [valid.criteria[0]] }));
  assert.ok(refused({ ...valid, criteria: Array(5).fill(valid.criteria[1]) }));
  assert.ok(refused({ ...valid, criteria: [valid.criteria[0], { text: '측정 없음' }] }));
  assert.ok(refused({ ...valid, outOfScope: 'not a list' }));
  assert.ok(refused({ ...valid, inScope: [1] }));
  assert.ok(refused({ ...valid, changeReason: 3 }));
  assert.ok(refused({ ...valid, changeReason: 'a'.repeat(501) }));
});

test('a prd: key resolves only when the saved PRD belongs to the signed-in user', async (t) => {
  const fetch = supabase(t, (url) => {
    assert.equal(url.pathname, '/rest/v1/evidence_dossiers');
    assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
    return { json: url.searchParams.get('id') === `eq.${DOSSIER}` ? [{ id: DOSSIER }] : [] };
  });
  assert.equal(await resolveProjectKey(service, USER, `prd:${DOSSIER.toUpperCase()}`), `prd:${DOSSIER}`);
  assert.equal(await resolveProjectKey(service, USER, 'prd:99999999-2222-3333-4444-555555555555'), null);
  assert.equal(fetch.mock.callCount(), 2);
});

test('a public slug resolves only when it names a real opportunity', async () => {
  const asked: string[] = [];
  const exists = async (slug: string) => { asked.push(slug); return slug === 'ai-coding-context'; };
  assert.equal(await resolveProjectKey(service, USER, 'ai-coding-context', exists), 'ai-coding-context');
  assert.equal(await resolveProjectKey(service, USER, 'no-such-problem', exists), null);
  for (const bad of ['', 'prd:not-a-uuid', 'Upper', '../etc', 'a'.repeat(121)]) assert.equal(await resolveProjectKey(service, USER, bad, exists), null);
  assert.deepEqual(asked, ['ai-coding-context', 'no-such-problem']);
});

test('locking calls lock_project_goal once and reports a missing change reason', async (t) => {
  const goal = readGoalInput(valid);
  assert.ok('goal' in goal);
  let reason = false;
  supabase(t, (url, body) => {
    assert.equal(url.pathname, '/rest/v1/rpc/lock_project_goal');
    assert.deepEqual(body, {
      p_user_id: USER, p_project_key: 'ai-coding-context', p_track: 'personal', p_statement: goal.goal.statement,
      p_criteria: goal.goal.criteria, p_in_scope: goal.goal.inScope, p_out_of_scope: goal.goal.outOfScope, p_change_reason: null,
    });
    if (reason) return { status: 400, json: { code: '22023', message: 'change_reason_required', details: null, hint: null } };
    return { json: {
      user_id: USER, project_key: 'ai-coding-context', version: 1, track: 'personal', statement: goal.goal.statement,
      criteria: goal.goal.criteria, in_scope: goal.goal.inScope, out_of_scope: goal.goal.outOfScope, change_reason: null, locked_at: '2026-11-20T09:00:00Z',
    } };
  });
  assert.deepEqual(await lockProjectGoal(service, USER, 'ai-coding-context', goal.goal), {
    projectKey: 'ai-coding-context', version: 1, track: 'personal', statement: goal.goal.statement, criteria: goal.goal.criteria,
    inScope: goal.goal.inScope, outOfScope: goal.goal.outOfScope, lockedAt: '2026-11-20T09:00:00Z', changeReason: null,
  });
  reason = true;
  assert.equal(await lockProjectGoal(service, USER, 'ai-coding-context', goal.goal), 'reason-required');
});

test('an env_name fact with a value is refused before anything is stored', async (t) => {
  const fetch = supabase(t, () => ({ json: [] }));
  await assert.rejects(addProjectMemory(service, USER, 'ai-coding-context', {
    kind: 'fact', body: { kind: 'env_name', text: 'OPENROUTER_API_KEY=sk-or-v1-abc', author: 'codex' },
  }), /key name only/);
  assert.equal(fetch.mock.callCount(), 0);
});
