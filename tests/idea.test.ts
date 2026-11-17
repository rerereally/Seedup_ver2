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
