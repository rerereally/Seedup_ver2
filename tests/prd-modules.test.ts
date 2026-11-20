import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrdEnrichment, PrdModuleSection } from '../components/opportunity-stage/PrdEnrichment';
import type { callJsonModel } from '../lib/llm';
import { parsePrdMarkdown } from '../lib/opportunities/prd-markdown';
import { answerPrdGaps, moduleFields, normalizeModules, PRD_MODULES, prdGaps } from '../lib/opportunities/prd-modules';
import { readPrdResearch, researchPrd, signPrdResearch, specIssues } from '../lib/opportunities/prd';
import { normalizeSpec, renderAgentBrief, renderSpecMarkdown, slotIsOpen } from '../lib/opportunities/spec';
import type { SpecInput } from '../lib/opportunities/spec';
import type { Evidence } from '../lib/opportunities/types';

const source = (id: string, quote: string): Evidence => ({
  id, quote, quoteKo: '', platform: 'github', url: `https://github.com/example/alerts/issues/${id}`, postedAt: null, score: 1,
});
const original = source('1', 'We cannot hand over alerts without a record of who edited them.');
const stored = source('lv_stored', 'Only the on-call lead can change which alerts are handed over.');
const unused = source('lv_unused', 'We use the service to keep track of our weekly release notes.');
const input: SpecInput = { title: 'Alerts handoff', problem: 'Hand over active alerts.', gap: '', competitors: [], evidence: [original] };
const legacy = `## Summary
Hand over active alerts.
## Requirements
### R1. [P0] Export alerts [E1]
Show the active alerts for the current handoff.
## Features
### F1. Export alerts (R1)
Return a list of active alerts.
## Hypotheses to validate
### H1. Handoff edit history
The team might need a history of edits to the handoff.`;

const enterprise = {
  id: 'enterprise', reason: 'The product is used by on-call teams.',
  fields: {
    audit: { text: original.quote, evidence: 1 },
    compliance: { text: 'Keep the audit log for 90 days.' },
    permissions: { text: 'TBD' },
  },
};

test('specIssues checks every defined field in all five modules', () => {
  for (const id of Object.keys(PRD_MODULES) as Array<keyof typeof PRD_MODULES>) {
    const spec = normalizeSpec({ ...parsePrdMarkdown(legacy), modules: [{ id, reason: 'Applies here.', fields: {} }] }, input.evidence, false, { lang: 'en' });
    for (const [, [, field]] of moduleFields(id)) assert.ok(specIssues(spec, input).some((issue) => issue.includes(`“${field}”`)), field);
  }
});

test('module normalization keeps two known modules and downgrades fabricated, mismatched and private citations', () => {
  const own = { ...source('own_1', stored.quote), platform: 'own' as const, url: '' };
  const raw = [
    { id: 'unknown', reason: 'Unknown' }, { id: 'api_tool', reason: '' },
    { ...enterprise, fields: {
      ...enterprise.fields,
      integrations: { text: 'A fabricated source quote. [E-99]', evidence: 1 },
      permissions: { text: stored.quote, evidence: 2 },
      invented_field: { text: original.quote, evidence: 1 },
    } },
    enterprise, { id: 'consumer', reason: 'Consumer app' }, { id: 'data_ai', reason: 'Data product' },
  ];
  const modules = normalizeModules(raw, [original, own]);
  assert.deepEqual(modules?.map(({ id }) => id), ['enterprise', 'consumer']);
  assert.deepEqual(modules?.[0].fields, {
    permissions: { text: stored.quote },
    compliance: { text: 'Keep the audit log for 90 days.' },
    audit: { text: original.quote, evidence: 1 },
    integrations: { text: 'A fabricated source quote.' },
  });
});

test('legacy PRDs without modules still parse and export', () => {
  const raw = parsePrdMarkdown(legacy)!;
  assert.equal(raw.modules, undefined);
  const spec = normalizeSpec(raw, input.evidence, false, { idea: true });
  assert.equal(spec.modules, undefined);
  for (const lang of ['ko', 'en'] as const) {
    const localized = { ...spec, lang };
    const exported = renderSpecMarkdown(input, localized);
    assert.equal(parsePrdMarkdown(exported)?.modules, undefined);
    assert.doesNotMatch(exported, /추가 모듈|PRD modules/);
    assert.doesNotMatch(renderAgentBrief(input, localized), /PRD modules/);
    assert.deepEqual(normalizeSpec(parsePrdMarkdown(exported)!, input.evidence, false, { idea: true }).features.map(({ requirementIds }) => requirementIds), [['R-01']]);
  }
});

test('Markdown round-trips modules in Korean and English and every export shows their basis', () => {
  const raw = parsePrdMarkdown(`${legacy}
## PRD modules
### enterprise
- reason: ${enterprise.reason}
- audit: ${original.quote} [E1]
- compliance: Keep the audit log for 90 days.
- permissions: TBD
### data_ai
- reason: The draft benchmarks a model.
- cost: Planner answer: Cap the budget at ten dollars.`)!;
  const spec = normalizeSpec(raw, input.evidence, false, { idea: true });
  for (const lang of ['ko', 'en'] as const) {
    const markdown = renderSpecMarkdown(input, { ...spec, lang });
    const restored = normalizeSpec(parsePrdMarkdown(markdown)!, input.evidence, false, { idea: true });
    assert.equal(restored.lang, lang);
    assert.deepEqual(restored.modules, spec.modules);
    assert.match(markdown, /\[H-\d+\] (가설|Hypothesis): Keep the audit log for 90 days/);
    assert.match(markdown, /\[H-\d+\] (확인 필요|Open question)/);
    assert.match(markdown, /edited them\. \[E-1\]/);
    assert.match(markdown, /\[H-\d+\] (가설 · 기획자 답변|Hypothesis · planner answer): Cap the budget/);
  }
  for (const format of ['agents', 'claude', 'cursor', 'prompt'] as const) {
    const result = renderAgentBrief(input, spec, format);
    assert.match(result, /## PRD modules/);
    assert.match(result, /Audit logs \(audit\)\*\*: .* \[E-1\]/);
  }
});

test('the document module section and enrichment entry render in both languages', () => {
  const spec = normalizeSpec({ ...parsePrdMarkdown(legacy), modules: [enterprise] }, input.evidence);
  for (const lang of ['ko', 'en'] as const) {
    const section = renderToStaticMarkup(createElement(PrdModuleSection, { spec, lang, pick: () => undefined }));
    assert.match(section, lang === 'ko' ? /추가 모듈/ : /PRD modules/);
    assert.match(section, lang === 'ko' ? /확인 필요/ : /Open question/);
    assert.match(section, /E-1/);
    const enrichment = renderToStaticMarkup(createElement(PrdEnrichment, {
      lang, busy: false, round: null, start: async () => undefined, apply: async () => undefined,
    }));
    assert.match(enrichment, lang === 'ko' ? /빈 곳 채우기/ : /Fill gaps/);
  }
});

test('research uses only verified quotes, asks at most five unresolved questions, and applies planner answers to those gaps', async () => {
  const spec = normalizeSpec({ ...parsePrdMarkdown(legacy), modules: [enterprise] }, input.evidence, false, { idea: true, lang: 'en' });
  let searches = 0;
  const ask: typeof callJsonModel = async <T>(prompt: string) => {
    assert.match(prompt, /F-01:access/);
    assert.match(prompt, /on-call lead/);
    return {
      findings: [
        { key: 'F-01:access', text: stored.quote, evidence: 3 },
        { key: 'enterprise:permissions', text: stored.quote, evidence: 3 },
        { key: 'H-01', text: original.quote, evidence: 1 },
        { key: 'F-01:errors', text: 'The on-call lead can see private alerts.', evidence: 3 },
        { key: 'F-01:done', text: 'lead can change which alerts are handed over.', evidence: 3 },
        { key: 'enterprise:audit', text: unused.quote, evidence: 2 },
      ],
      questions: [
        { key: 'F-01:access', question: 'Should we ask about permissions again?' },
        { key: 'F-01:errors', question: 'What if an alert is missing?', why: 'This determines the error behavior.', options: ['Show a warning', 'Retry'] },
      ],
    } as T;
  };
  const researched = await researchPrd(input, spec, 8, Date.now() + 60_000, {
    stored: async (terms) => {
      searches++;
      assert.ok(terms.includes('alerts'));
      return [unused, stored].map((row) => ({ ...row, terms }));
    },
    ask,
  });
  assert.equal(searches, 1);
  assert.equal(researched.filled, 3);
  assert.deepEqual(researched.added, [stored]);
  assert.deepEqual(researched.spec.features[0].slots?.access, [`${stored.quote} [E-2]`]);
  assert.deepEqual(researched.spec.modules?.[0].fields.permissions, { text: stored.quote, evidence: 2 });
  assert.deepEqual(researched.spec.hypotheses[0].followup, { text: original.quote, evidence: 1 });
  assert.deepEqual(researched.spec.hypotheses[0].evidence, []);
  assert.ok(slotIsOpen(researched.spec.features[0].slots?.errors));
  assert.ok(slotIsOpen(researched.spec.features[0].slots?.done));
  assert.equal(researched.questions.length, 5);
  assert.ok(researched.remaining > researched.questions.length);
  assert.ok(!researched.questions.some(({ key }) => key === 'F-01:access'));
  assert.deepEqual(researched.questions.find(({ key }) => key === 'F-01:errors')?.chips, ['Show a warning', 'Retry']);

  const result = answerPrdGaps(researched.spec, [
    { key: 'F-01:errors', answer: 'Show a warning / retry. [E-54]' },
    { key: 'F-01:inputs', answer: '' },
    { key: 'enterprise:audit', answer: 'Replace the already verified field' },
  ]);
  assert.ok(result);
  assert.equal(result.filled, 1);
  assert.deepEqual(result.spec.features[0].slots?.errors, ['Planner answer: Show a warning / retry.']);
  assert.ok(slotIsOpen(result.spec.features[0].slots?.inputs));
  assert.deepEqual(result.spec.modules?.[0].fields.audit, enterprise.fields.audit);
  assert.equal(prdGaps(result.spec).length, researched.remaining - 1);

  const enrichedInput = { ...input, evidence: [...input.evidence, ...researched.added] };
  assert.match(renderAgentBrief(enrichedInput, result.spec), /H-01.*Research quote: .* \[E-1\]/);
  for (const lang of ['ko', 'en'] as const) {
    const markdown = renderSpecMarkdown(enrichedInput, { ...result.spec, lang });
    const restored = normalizeSpec(parsePrdMarkdown(markdown)!, enrichedInput.evidence, false, { idea: true });
    assert.deepEqual(restored.features[0].slots, result.spec.features[0].slots);
    assert.deepEqual(restored.hypotheses[0].followup, result.spec.hypotheses[0].followup);
    assert.deepEqual(restored.modules, result.spec.modules);
  }
});

test('research failure leaves every gap open and provides fallback questions', async () => {
  const spec = normalizeSpec(parsePrdMarkdown(legacy)!, input.evidence, false, { idea: true });
  const result = await researchPrd(input, spec, 8, Date.now() + 60_000, {
    stored: async () => { throw new Error('fixture storage failure'); },
    ask: async () => null,
  });
  assert.equal(result.filled, 0);
  assert.deepEqual(result.added, []);
  assert.equal(result.questions.length, 5);
  assert.ok(result.questions.every(({ text }) => text.endsWith('?')));
  assert.ok(slotIsOpen(result.spec.features[0].slots?.access));
});

test('later revisions accept research sources only for the issuing user and in the signed order', () => {
  const secret = 'fixture-key';
  const receipt = signPrdResearch('owner', input, [stored, unused], secret);
  assert.deepEqual(readPrdResearch(receipt, 'owner', input, secret), [stored, unused]);
  assert.equal(readPrdResearch(receipt, 'someone-else', input, secret), null);
  assert.equal(readPrdResearch(receipt, 'owner', { ...input, evidence: [] }, secret), null);
  assert.equal(readPrdResearch({ ...receipt, rows: [unused, stored] }, 'owner', input, secret), null);
  assert.equal(readPrdResearch({ ...receipt, rows: [{ ...stored, quote: 'A forged quote.' }, unused] }, 'owner', input, secret), null);
  assert.equal(readPrdResearch({ rows: [stored] }, 'owner', input, secret), null);
});
