import assert from 'node:assert/strict';
import test from 'node:test';
import { ideaSpecInput, readBrief } from '../lib/opportunities/idea';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { Opportunity } from '../lib/opportunities/types';

const opportunity = { slug: 'schema', name: 'Schema', problem: 'Providers differ', gap: 'No discovery API', keywords: [], status: 'open', qualified: true, platforms: ['hn'], supply: [{ kind: 'npm', name: 'rival', description: '', popularity: 0, url: 'u', createdAt: null, relation: 'direct' }], directCount: 1, firstSeenAt: null, followersAfterSignal: 0, evidence: [{ id: 'e1', platform: 'hn', quote: 'q1', quoteKo: '', url: 'u1', score: 0, postedAt: null }] } as Opportunity;

test('reads an idea brief and drops empty or oversized parts', () => {
  assert.equal(readBrief({ idea: 'ab' }), null);
  const brief = readBrief({ idea: '  A tool  ', answers: [{ question: 'Who', answer: 'Solo devs' }, { question: 'Skip', answer: '' }, 'junk'] });
  assert.deepEqual(brief, { idea: 'A tool', answers: [{ question: 'Who', answer: 'Solo devs' }] });
  assert.equal(readBrief({ idea: 'x'.repeat(500) })!.idea.length, 300);
});

test('an idea input carries the answers and only the kept quotes', () => {
  const brief = { idea: 'Switch LLM providers', answers: [{ question: 'Who', answer: 'Solo devs' }] };
  const bare = ideaSpecInput([opportunity], brief, []);
  assert.equal(bare.evidence.length, 0);
  assert.match(bare.problem, /Solo devs/);
  const withQuotes = ideaSpecInput([opportunity], brief, [{ evidence: opportunity.evidence[0], slug: 'schema' }]);
  assert.deepEqual(withQuotes.evidence.map((row) => row.id), ['e1']);
  assert.deepEqual(withQuotes.competitors, ['rival']);
  assert.match(withQuotes.problem, /Providers differ/);
});

test('idea specs keep features that serve hypotheses; classic specs drop them', () => {
  const raw = { summary: 's', requirements: [{ title: 'Backed', evidence: [1] }, { title: 'Asked by the user', evidence: [] }], features: [{ title: 'From answer', requirements: [2] }], screens: [{ name: 'Home', features: [1] }] };
  const classic = normalizeSpec(raw, 1);
  assert.equal(classic.features.length, 0);
  const idea = normalizeSpec(raw, 1, false, { idea: true });
  assert.deepEqual(idea.features.map((row) => row.requirementIds), [['H-01']]);
  assert.equal(idea.screens.length, 1);
  assert.equal(idea.origin, 'idea');
});

import { inputFromBody, withNotes } from '../lib/opportunities/idea';
import { mapPoints } from '../lib/opportunities/map';

test('the maker\'s notes reach the PRD context, labeled as not evidence', () => {
  const resolved = inputFromBody([opportunity], { evidenceIds: ['e1'], notes: '  CLI only, no payments  ' }, 'ko')!;
  assert.equal(resolved.notes, 'CLI only, no payments');
  assert.match(resolved.input.problem, /만드는 사람의 의견 \(근거 아님\):\nCLI only, no payments/);
  assert.equal(withNotes(resolved.input, '').problem, resolved.input.problem);
  assert.equal(inputFromBody([opportunity], { evidenceIds: ['e1'] }, 'ko')!.notes, '');
});

test('the map places problems by counted values only', () => {
  const crowded = { ...opportunity, slug: 'crowded', directCount: 4 };
  const [open, busy] = mapPoints([opportunity, crowded], Date.parse('2026-11-17T00:00:00Z'));
  assert.ok(open.openness > busy.openness);
  assert.ok(open.strength > 0 && open.strength < 1);
  assert.equal(open.recent, 0);
});

test('live web quotes count only with a valid server signature, and only for idea PRDs', async () => {
  const { signEvidence, readLiveEvidence } = await import('../lib/opportunities/live-evidence');
  const quote = { id: 'lv_abc', platform: 'hn' as const, quote: 'I keep rewriting the same glue code', quoteKo: '', url: 'https://news.ycombinator.com/item?id=1', score: 3, postedAt: null };
  const signed = signEvidence(quote, 'k')!;
  assert.deepEqual(readLiveEvidence([signed], 5, 'k'), [quote]);
  assert.deepEqual(readLiveEvidence([{ ...signed, quote: 'invented words' }], 5, 'k'), []);
  assert.deepEqual(readLiveEvidence([signed], 5, 'other-key'), []);
  assert.deepEqual(readLiveEvidence([signed], 5, ''), []);
  process.env.LIVE_EVIDENCE_SECRET = 'k';
  const withIdea = inputFromBody([opportunity], { brief: { idea: 'Glue code generator' }, liveEvidence: [signed] }, 'ko')!;
  assert.deepEqual(withIdea.picked.map((row) => row.evidence.id), ['lv_abc']);
  const classic = inputFromBody([opportunity], { evidenceIds: ['e1'], liveEvidence: [signed] }, 'ko')!;
  assert.deepEqual(classic.picked.map((row) => row.evidence.id), ['e1']);
  delete process.env.LIVE_EVIDENCE_SECRET;
});

import { platformOfUrl, safeSourceUrl } from '../lib/opportunities/live-evidence';

test('a pasted link is fetched only when it is a public http(s) address with a host name', () => {
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'http://localhost:3000', 'http://127.0.0.1/', 'http://10.0.0.5/x', 'http://[::1]/', 'http://intranet/', 'http://db.internal/', 'https://user:pw@github.com/a', 'not a url']) {
    assert.equal(safeSourceUrl(bad), null, bad);
  }
  assert.equal(safeSourceUrl('https://github.com/a/b/issues/1')?.hostname, 'github.com');
});

test('the platform comes from the link host', () => {
  assert.equal(platformOfUrl(new URL('https://github.com/a/b/issues/1')), 'github');
  assert.equal(platformOfUrl(new URL('https://news.ycombinator.com/item?id=1')), 'hn');
  assert.equal(platformOfUrl(new URL('https://stackoverflow.com/questions/1/x')), 'stackoverflow');
  assert.equal(platformOfUrl(new URL('https://unix.stackexchange.com/questions/1')), 'stackexchange');
  assert.equal(platformOfUrl(new URL('https://blog.example.com/post')), 'web');
});

import { builtReply } from '../lib/opportunities/outreach';

test('the built reply quotes the person, links the product and asks instead of selling', () => {
  const reply = builtReply('I keep leaking API keys in my side projects', 'https://keyguard.dev', 'It scans every push.');
  assert.match(reply, /you wrote "I keep leaking API keys in my side projects"/);
  assert.match(reply, /fix it: It scans every push\./);
  assert.match(reply, /https:\/\/keyguard\.dev/);
  assert.match(reply, /\?/);
  assert.ok(builtReply('x'.repeat(300), 'https://a.b').includes('…'));
});

import { fetchPageText } from '../lib/opportunities/web';

test('fetchPageText blocks redirects to private or local hosts and follows safe redirects', async () => {
  const redirectTo = (location: string): typeof fetch => (async () => new Response(null, { status: 302, headers: { location } })) as typeof fetch;
  assert.equal(await fetchPageText('https://example.com/start', redirectTo('http://127.0.0.1/admin')), null);
  assert.equal(await fetchPageText('https://example.com/start', redirectTo('http://localhost:3000/secret')), null);

  let hops = 0;
  const safeRedirect: typeof fetch = (async () => {
    hops += 1;
    return hops === 1
      ? new Response(null, { status: 301, headers: { location: '/article' } })
      : new Response('<html><body><p>Hello verified world</p></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
  assert.equal(await fetchPageText('https://example.com/start', safeRedirect), 'Hello verified world');
});

test('fetchPageText stops reading and cancels the stream once the byte cap is reached', async () => {
  const encoder = new TextEncoder();
  let pulls = 0;
  let canceled = false;
  const oversized: typeof fetch = (async () => new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(encoder.encode(pulls === 1 ? '<p>start</p>' : 'x'.repeat(100)));
    },
    cancel() {
      canceled = true;
    },
  }, { highWaterMark: 0 }), { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;

  const text = await fetchPageText('https://example.com/huge', oversized, 50);
  assert.equal(canceled, true);
  assert.equal(pulls, 2);
  assert.ok(text?.startsWith('start'));
  assert.ok((text?.length ?? 0) <= 50);
});

import { ideaAudience } from '../lib/ideas/input';

test('ideaAudience extracts the target audience noun (longer words first) or returns null', () => {
  assert.equal(ideaAudience('대학생 가계부 앱', 'ko'), '대학생');
  assert.equal(ideaAudience('1인 개발자를 위한 배포 자동화 도구', 'ko'), '1인 개발자');
  assert.equal(ideaAudience('AI 에이전트 권한 관리', 'ko'), null);
  assert.equal(ideaAudience('A budgeting app for students', 'en'), 'Students');
  assert.equal(ideaAudience('An invoicing tool for freelancers', 'en'), 'Freelancers');
  assert.equal(ideaAudience('AI agent permission guardrails', 'en'), null);
});
