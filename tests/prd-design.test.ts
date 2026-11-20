import assert from 'node:assert/strict';
import test from 'node:test';
import type { callJsonModel } from '../lib/llm';
import { keepUnchanged } from '../lib/opportunities/prd';
import { normalizeDifferentiation } from '../lib/opportunities/prd-design';
import { findDifferentiationOverlap, withDifferentiationQuestion } from '../lib/opportunities/prd-differentiation';
import { parsePrdMarkdown } from '../lib/opportunities/prd-markdown';
import { prdUserPrompt } from '../lib/opportunities/prd-prompt';
import { normalizeSpec, renderAgentBrief, renderSpecMarkdown, type SpecInput } from '../lib/opportunities/spec';

const listing = 'Exports the selected alerts as a local CSV file.';
const input: SpecInput = {
  title: 'Alert history',
  problem: 'Keep the tool local and expose it as a CLI.',
  gap: '',
  evidence: [],
  competitors: ['Example'],
  competitorNotes: [`Example: ${listing}`],
};

const legacy = `# Summary
Export alert history.

## Requirements
### R2. Export selected alerts [E1]
### R6. Inspect a draft export

## Features
### F3. Export (R2)
### F7. Preview (R6)`;

const design = `
## Differentiation
Export the selected alerts as a local CSV file. [E1, E99] An unsupported second claim.
- Competitor listing: Example | ${listing}

## Technical design
### Architecture
The local CLI reads a file and hands it to a formatter.
### Data model
- Alert — id, level, occurredAt.
### Interfaces
- alerts export — accepts a filter and returns a CSV path.
### Stack and rationale
- TypeScript for typed command arguments.
### Implementation order
1. Define the export record (F3)
2. Return a preview (F7)
3. Wire both commands (F3, F7)
4. Invalid links (F99)`;

test('design and one cited differentiator round-trip in Korean and English and reach the agent export', () => {
  const parsed = parsePrdMarkdown(legacy + design);
  assert.ok(parsed);
  const options = { idea: true, competitorNotes: input.competitorNotes };
  const spec = normalizeSpec(parsed, 1, true, options);
  assert.deepEqual(spec.differentiation, {
    claim: 'Export the selected alerts as a local CSV file.',
    evidence: [1],
    competitor: { name: 'Example', quote: listing },
  });
  assert.deepEqual(spec.technicalDesign?.milestones.map((row) => row.featureIds), [['F-01'], ['F-02'], ['F-01', 'F-02']]);
  for (const lang of ['en', 'ko'] as const) {
    const markdown = renderSpecMarkdown(input, { ...spec, lang });
    const reparsed = parsePrdMarkdown(markdown);
    assert.ok(reparsed);
    const reloaded = normalizeSpec(reparsed, 1, true, options);
    assert.deepEqual(reloaded.differentiation, spec.differentiation);
    assert.deepEqual(reloaded.technicalDesign, spec.technicalDesign);
  }
  const brief = renderAgentBrief(input, spec);
  assert.match(brief, /### Implementation order\n1\. Define the export record \(F-01\)/);
  assert.match(brief, /3\. Wire both commands \(F-01, F-02\)/);
});

test('older specs still load and a saved idea without public quotes keeps its build order', () => {
  const raw = parsePrdMarkdown(legacy);
  assert.ok(raw);
  const old = normalizeSpec(raw, 1);
  assert.equal(old.technicalDesign, undefined);
  assert.equal(old.differentiation, undefined);
  const idea = normalizeSpec(parsePrdMarkdown(legacy + design) ?? {}, 0, true, { idea: true });
  const saved = parsePrdMarkdown(renderSpecMarkdown(input, idea));
  assert.ok(saved);
  assert.deepEqual(normalizeSpec(saved, 0, true, { idea: true }).technicalDesign, idea.technicalDesign);
  const prompt = prdUserPrompt(input, { idea: true, stack: ['TypeScript'] });
  assert.match(prompt, /expose it as a CLI/);
  assert.match(prompt, /<선호 기술>\n\["TypeScript"\]/);
});

test('competitor-only citations are verified against known listings and overlap uses one short call', async () => {
  const raw = parsePrdMarkdown(legacy + design);
  assert.ok(raw);
  const spec = normalizeSpec(raw, 0, true, { idea: true, competitorNotes: input.competitorNotes });
  assert.deepEqual(spec.differentiation?.competitor, { name: 'Example', quote: listing });
  assert.equal(normalizeDifferentiation({ claim: 'A claim.', evidence: [5], competitor: { name: 'Other', quote: listing } }, 1, input.competitorNotes), undefined);
  assert.equal(normalizeDifferentiation({ claim: 'A claim.', competitor: { name: 'Example', quote: 'An invented description.' } }, 1, input.competitorNotes), undefined);
  const options = { model: 'test', deadline: Date.now() + 60_000 };
  let calls = 0;
  const call: typeof callJsonModel = async <T>(prompt: string, opts?: Parameters<typeof callJsonModel>[1]) => {
    calls++;
    assert.equal(opts?.attempts, 1);
    assert.deepEqual(opts?.models, ['test']);
    assert.ok((opts?.deadline ?? Infinity) <= Date.now() + 18_000);
    assert.match(prompt, /selected alerts/);
    return { listing: 0, quote: listing } as T;
  };
  const overlap = await findDifferentiationOverlap(input, spec, options, call);
  assert.equal(calls, 1);
  assert.deepEqual(overlap, { name: 'Example', quote: listing });
  const result = withDifferentiationQuestion({ ...spec, lang: 'en', openQuestions: ['Who needs a preview?'] }, overlap);
  assert.equal(result.differentiation, undefined);
  assert.match(result.openQuestions?.[0] ?? '', /Example already lists/);
  assert.equal(result.openQuestions?.[1], 'Who needs a preview?');
  assert.equal(await findDifferentiationOverlap(input, spec, options, async <T>() => ({ listing: 0, quote: 'A fabricated listing excerpt.' }) as T), null);
  assert.equal(await findDifferentiationOverlap(input, spec, options, async () => { throw new Error('Unavailable'); }), null);
  assert.strictEqual(withDifferentiationQuestion(spec, null), spec);
});

test('a partial revision preserves design and updates milestones to the remaining features', () => {
  const raw = parsePrdMarkdown(legacy + design);
  assert.ok(raw);
  const spec = normalizeSpec(raw, 1, true, { idea: true });
  assert.ok(Array.isArray(raw.features));
  const revision = normalizeSpec({ ...raw, features: [raw.features[1]], technicalDesign: undefined, differentiation: undefined }, 1, true, { idea: true });
  const merged = keepUnchanged(spec, revision);
  assert.equal(merged.differentiation, spec.differentiation);
  assert.deepEqual(merged.technicalDesign?.milestones, [
    { title: 'Return a preview', featureIds: ['F-01'] },
    { title: 'Wire both commands', featureIds: ['F-01'] },
  ]);
});
