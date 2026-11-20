import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { briefFacts, saveProjectBrief } from '../lib/db/project-brief';
import type { Evidence, Platform } from '../lib/opportunities/types';

const quote = (id: string, platform: Platform): Evidence => ({ id, platform, quote: 'q', quoteKo: 'q', url: 'https://example.com', score: 1, postedAt: null });

test('the verdict comes from the saved quotes, and own notes do not count', () => {
  const [verdict] = briefFacts({}, [quote('a', 'github'), quote('b', 'github'), quote('c', 'own')]);
  assert.match(verdict, /^Evidence verdict: 2 verified quotes from 1 site\. Below the 3-quotes-from-2-sites bar/);
  assert.match(briefFacts({}, [quote('a', 'github'), quote('b', 'hn'), quote('c', 'github')])[0], /Meets the 3-quotes-from-2-sites bar\.$/);
});

test('competitors and answers are trimmed, and junk is dropped', () => {
  const facts = briefFacts({
    competitors: ['  Linear ', '', 42, 'Jira'],
    answers: [{ question: '누가 쓰나요?', answer: ' 1인 개발자 ' }, { question: 'empty' }, 'junk', null],
  }, []);
  assert.deepEqual(facts.slice(1), ['Direct competitors found in planning: Linear; Jira', 'Planning answer. 누가 쓰나요?: 1인 개발자']);
  assert.equal(briefFacts(null, []).length, 1);
});


test('saving an owned quote-free PRD brief writes planning facts once, with no locked goal needed', async () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const project = `prd:${id}`;
  const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const saved: Array<{ id: string; body: { text: string }; created_at: string }> = [];
  const client = createClient('https://supabase.invalid', 'test-key', {
    auth: { persistSession: false }, global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      if (url.pathname === '/rest/v1/evidence_dossiers' && method === 'GET') {
        assert.equal(url.searchParams.get('id'), `eq.${id}`);
        return Response.json(url.searchParams.get('user_id') === `eq.${user}` ? [{ id, evidence: [], prd_markdown: '# Private PRD' }] : []);
      }
      if (url.pathname === '/rest/v1/supervisor_projects' && method === 'POST') {
        assert.deepEqual(JSON.parse(String(init?.body)), { user_id: user, project_key: project });
        return new Response(null, { status: 201 });
      }
      assert.equal(url.pathname, '/rest/v1/project_memory');
      if (method === 'POST') {
        const { user_id, project_key, kind, body } = JSON.parse(String(init?.body));
        assert.deepEqual({ user_id, project_key, kind }, { user_id: user, project_key: project, kind: 'fact' });
        const row = { id: String(saved.length + 1), created_at: new Date().toISOString(), body };
        saved.push(row);
        return Response.json(row, { status: 201 });
      }
      assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
      assert.equal(url.searchParams.get('project_key'), `eq.${project}`);
      return Response.json(url.searchParams.get('kind') === 'eq.fact' ? saved : []);
    } },
  });
  const answer = { question: 'Who needs this?', answer: 'SRE teams using API_KEY=1aBc3DeF4gHiJkLmNO5p' };
  const brief = { competitors: ['PagerDuty'], answers: [answer, answer] };
  assert.deepEqual(await saveProjectBrief(user, project, brief, client), { added: 3 });
  assert.deepEqual(await saveProjectBrief(user, project, brief, client), { added: 0 });
  assert.equal(await saveProjectBrief('another-user', project, brief, client), null);
  assert.match(saved[0].body.text, /^Evidence verdict: 0 verified quotes/);
  assert.equal(saved[1].body.text, 'Direct competitors found in planning: PagerDuty');
  assert.equal(saved[2].body.text, 'Planning answer. Who needs this?: SRE teams using API_KEY=[REDACTED secret]');
});
