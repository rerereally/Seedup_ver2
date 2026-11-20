import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { lockProjectGoal, readGoalInput, recheckForGoalChange, userProjectGoals } from '../lib/db/project-goals';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { ProjectGoal } from '../lib/supervisor/types';
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
  assert.ok(refused({ ...valid, criteria: [{ ...valid.criteria[0], featureIds: ['R-01'] }, valid.criteria[1]] }));
  assert.ok(refused({ ...valid, criteria: [{ ...valid.criteria[0], featureIds: null }, valid.criteria[1]] }));
});

test('a personal PRD with a related opportunity keeps confirmed links to hypothesis features', async (t) => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
    SUPABASE_SECRET_KEY: 'test-secret-key',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  let saved: Record<string, unknown> | undefined;
  supabase(t, (url, body) => {
    if (url.pathname.endsWith('/rpc/lock_project_goal')) {
      const input = body as { p_criteria: unknown };
      saved = { project_key: `prd:${DOSSIER}`, version: 1, track: 'personal', statement: valid.statement,
        criteria: input.p_criteria, in_scope: [], out_of_scope: [], change_reason: null, locked_at: '2026-11-20T09:00:00Z' };
      return { json: saved };
    }
    assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
    if (url.pathname.endsWith('/project_goals')) return { json: saved ? [saved] : [] };
    assert.ok(url.pathname.endsWith('/evidence_dossiers'));
    return { json: [{ id: DOSSIER, evidence: [], opportunity_slug: 'related-opportunity',
      prd_markdown: '## 검증이 필요한 가설\n### H-01. 기록 저장\n## 기능\n### F-01. 기록하기 (H-01)' }] };
  });
  const project = await userProjectGoals(USER, `prd:${DOSSIER}`);
  assert.ok(project && project !== 'unavailable');
  const input = (featureIds: string[]) => readGoalInput({ ...valid, criteria: [
    { ...valid.criteria[0], featureIds }, { ...valid.criteria[1], featureIds: [] },
  ] });
  const invalid = input(['F-99']);
  assert.ok('goal' in invalid);
  assert.equal(await project.lock(invalid.goal), 'invalid-feature-ids');
  assert.equal(saved, undefined);

  const confirmed = input(['F-01', 'F-01']);
  assert.ok('goal' in confirmed);
  const goal = await project.lock(confirmed.goal);
  assert.ok(typeof goal !== 'string');
  assert.deepEqual(goal.criteria.map((row) => row.featureIds), [['F-01'], []]);
  assert.deepEqual(await project.current(), goal);
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

test('a new goal version sends started or done features of edited criteria to needs_recheck, not untouched ones', async (t) => {
  const spec = normalizeSpec({
    summary: 'Ledger',
    requirements: [{ title: '하루 기록', detail: '기록이 빨리 끝난다', evidence: [1] }, { title: '월말 합계', detail: '잔고 대조', evidence: [1] }],
    features: [{ title: '빠른 기록', detail: '기록 화면', requirements: [1] }, { title: '합계 보고서', detail: '월말 합계', requirements: [2] }],
  }, 1);
  const goal = (version: number, measure: string): ProjectGoal => ({
    projectKey: `prd:${DOSSIER}`, version, track: 'personal', statement: 's', inScope: [], outOfScope: [], lockedAt: '', changeReason: null,
    criteria: [{ id: 'G-1', text: '하루 기록이 1분 안에 끝난다', measure, status: 'open' }, { id: 'G-2', text: '월말 합계가 잔고와 맞는다', measure: '3개월 대조', status: 'open' }],
  });
  const writes: unknown[] = [];
  supabase(t, (url, body) => {
    if (url.pathname.endsWith('/rpc/write_build_progress')) { writes.push(body); return { json: true }; }
    return { json: [
      { feature_id: spec.features[0].id, feature_title: '빠른 기록', status: 'done', note: '', updated_at: '', done_at: '' },
      { feature_id: spec.features[1].id, feature_title: '합계 보고서', status: 'todo', note: '', updated_at: '', done_at: null },
    ] };
  });
  const flagged = await recheckForGoalChange(service, USER, `prd:${DOSSIER}`, goal(1, '저장까지 시간'), goal(2, '저장 버튼까지 초'), async () => spec);
  assert.deepEqual(flagged, [spec.features[0].id]);
  assert.equal(writes.length, 1);
  assert.equal((writes[0] as { p_status: string }).p_status, 'needs_recheck');
  assert.match((writes[0] as { p_note: string }).p_note, /목표 v2에서 G-1/);
  assert.deepEqual(await recheckForGoalChange(service, USER, `prd:${DOSSIER}`, goal(1, 'x'), goal(2, 'x'), async () => spec), []);
});
