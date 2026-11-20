import assert from 'node:assert/strict';
import test from 'node:test';
import { inputFromBody } from '../lib/opportunities/idea';
import { assessPushback, suggestDirections } from '../lib/opportunities/pushback';
import { parsePrdMarkdown } from '../lib/opportunities/prd-markdown';
import { normalizeSpec, renderAgentBrief, renderSpecMarkdown } from '../lib/opportunities/spec';
import type { Evidence, Opportunity } from '../lib/opportunities/types';

const idea = 'Alert history for designers';
const answers = [
  { key: 'first_users', question: 'Who uses it first?', answer: 'Designers' },
  { key: 'must', question: 'What must the first version do?', answer: 'export CSV alerts, sync payroll, send invoices' },
];
const quote: Evidence = {
  platform: 'github', id: 'a', quote: 'I am a backend developer. I need alert history after restarting.', quoteKo: '',
  url: 'https://example.test/alerts/1', score: 2, postedAt: null,
};
const supply: Opportunity['supply'] = [{
  name: 'AlertDesk', relation: 'direct', kind: 'npm', description: 'Exports CSV alerts on demand.', url: 'https://example.test/tool', popularity: 1, createdAt: null,
}];
const notes = supply.map((row) => `${row.name}: ${row.description}`);
const problem: Opportunity = {
  slug: 'alert-history', name: 'Alert history', problem: 'Alert history is lost after restart.', gap: 'Restore alert history locally.',
  keywords: ['alert', 'history'], status: 'open', qualified: false, platforms: ['github'], evidence: [quote], supply,
  directCount: 1, firstSeenAt: null, followersAfterSignal: 0,
};

test('review detects explicit audience and listing conflicts, unsupported features and oversized scope within the cited set', () => {
  const duplicate = { ...quote, id: 'a2', quote: 'Our alert history is lost after a restart.' };
  const issues = assessPushback(idea, answers, [{ ...quote, platform: 'own' }, quote, duplicate], notes);
  assert.deepEqual(new Set(issues.map(({ kind }) => kind)), new Set(['audience', 'scope', 'existing', 'unsupported']));
  assert.deepEqual(issues.find(({ kind }) => kind === 'audience')?.evidence, [2]);
  assert.equal(issues.find(({ kind }) => kind === 'existing')?.competitor, 'AlertDesk');
  assert.deepEqual(issues.find(({ kind }) => kind === 'scope')?.evidence, [3]);
  assert.ok(issues.filter(({ kind }) => kind === 'unsupported').every((row) => row.evidence.length === 1 && !row.evidence.includes(1)));
});

test('ambiguous authors, unrelated evidence, unsupported names and negative listings do not produce findings', () => {
  assert.deepEqual(assessPushback(idea, answers, [], ['AlertDesk']), []);
  assert.deepEqual(assessPushback(idea, answers, [{ ...quote, quote: "I'm building software for designers. Give me better map search." }], [
    'AlertDesk: Cannot export CSV alerts. CSV export is planned.', 'Offtopic: Pick a color palette.',
  ]), []);
  const mixed = assessPushback(idea, answers.slice(0, 1), [quote, { ...quote, quote: 'I am a designer and alert history disappears.' }], []);
  assert.ok(mixed.every((row) => row.kind !== 'audience'));
  assert.equal(assessPushback('A tool to export CSV alerts.', [], [quote], notes)[0]?.competitor, 'AlertDesk');
  assert.deepEqual(assessPushback('Alert history', [{ ...answers[1], answer: 'Not sure. Decide what fits the idea and the quotes.' }], [quote], notes), []);
});

test('directions carry real quote and direct-competitor counts and exclude unmatched or ungrounded topics', () => {
  const current = { ...problem, evidenceCount: 4 };
  const related = { ...current, slug: 'alert-retention', name: 'Alert history retention', gap: '', problem: 'Pin alert history before a release.', evidenceCount: 3, directCount: 2 };
  const empty = { ...current, slug: 'no-quotes', evidenceCount: 0 };
  const other = { ...current, slug: 'recipes', name: 'Recipes', keywords: ['cooking'] };
  const directions = suggestDirections(idea, [current, related, empty, other], [current.slug]);
  assert.deepEqual(directions.map(({ direction, evidenceCount, directCount }) => [direction, evidenceCount, directCount]), [
    ['Restore alert history locally.', 4, 1],
    ['Pin alert history before a release.', 3, 2],
  ]);
});

test('keeping the submitted idea makes challenged capabilities hypotheses even when the draft cites quotes or omits them', () => {
  const resolved = inputFromBody([problem], {
    brief: { idea, answers },
    evidenceIds: [quote.id],
    review: [{ kind: 'existing', claim: 'Forged note', competitor: 'A stranger' }],
  }, 'en');
  assert.ok(resolved?.input.pushback);
  assert.ok(resolved.input.pushback.every((row) => row.claim !== 'Forged note'));
  const spec = normalizeSpec({
    summary: 'Recover alerts',
    requirements: [
      { title: 'Restore alert history', evidence: [1] },
      { title: 'Sync payroll', evidence: [1] },
    ],
    features: [{ title: 'Payroll sync', requirements: [2] }],
  }, resolved.input.evidence, true, { idea: true, lang: 'en', pushback: resolved.input.pushback });
  assert.deepEqual(spec.requirements.map((row) => row.title), ['Restore alert history']);
  const payroll = spec.hypotheses.find((row) => row.title === 'Sync payroll');
  assert.deepEqual(payroll?.evidence, []);
  assert.deepEqual(spec.features[0].requirementIds, [payroll?.id]);
  assert.ok(spec.hypotheses.some((row) => row.title === 'export CSV alerts' && row.check));
  assert.match(renderAgentBrief(resolved.input, spec), /## Review notes/);
  const markdown = renderSpecMarkdown(resolved.input, { ...spec, lang: 'en' });
  assert.match(markdown, /## Review notes[\s\S]+AlertDesk already lists/);
  const parsed = parsePrdMarkdown(markdown);
  assert.ok(parsed);
  assert.deepEqual(normalizeSpec(parsed, 1, true, { idea: true }).reviewNotes, spec.reviewNotes);
});
