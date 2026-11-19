import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hashPrediction, parseSealedPredictions, scorePredictions, sealPredictions } from '../lib/opportunities/predictions';
import type { Opportunity, SupplyItem } from '../lib/opportunities/types';
import { appendPredictions } from '../scripts/seal-predictions';

const day = 86_400_000;
const now = Date.parse('2026-11-19T10:00:00.000Z');
const tool = (createdAt: string | null, relation: SupplyItem['relation'] = 'direct'): SupplyItem => ({
  createdAt, relation, kind: 'github', name: 'tool', description: '', popularity: 0, url: 'tool-url',
});
const opportunity: Opportunity = {
  slug: 'sample', name: '예측할 기회', problem: '', gap: '', keywords: [], status: 'open', qualified: true,
  platforms: ['hn', 'github'],
  evidence: ['hn', 'github', 'hn'].map((platform, index) => ({
    id: `e${index}`, platform: platform as 'hn' | 'github', quote: 'quote', quoteKo: '', url: `url${index}`, score: 0, postedAt: null,
  })),
  supply: [tool('2026-10-06T10:00:00Z')],
  directCount: 1, firstSeenAt: '2026-10-01T10:00:00Z', followersAfterSignal: 1,
};

test('sealing uses the historical median and records only qualified opportunities', () => {
  const unqualified = { ...opportunity, slug: 'unqualified', qualified: false, supply: [tool('2026-10-04T10:00:00Z', 'partial')] };
  const future = { ...opportunity, slug: 'future', qualified: false, supply: [tool('2026-11-20T10:00:00Z')] };
  const [{ hash, ...prediction }] = sealPredictions([opportunity, unqualified, future], now);
  assert.equal(sealPredictions([opportunity, unqualified, future], now).length, 1);
  assert.deepEqual(prediction, {
    slug: opportunity.slug, name: opportunity.name, claim: 'A direct tool appears within 4 days', withinDays: 4,
    evidenceCount: 3, platformCount: 2, directCount: 1, sealedAt: '2026-11-19T10:00:00.000Z',
  });
  assert.equal(hash, hashPrediction(prediction));
});

test('the SHA-256 seal is independent of object key order and covers every field', () => {
  const [sealed] = sealPredictions([opportunity], now);
  const { hash, ...prediction } = sealed;
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(sealPredictions([opportunity], now), [sealed]);
  assert.equal(hashPrediction(Object.fromEntries(Object.entries(prediction).reverse()) as typeof prediction), hash);
  for (const [key, value] of Object.entries(prediction)) {
    const change = typeof value === 'number' ? value + 1 : `${value}!`;
    assert.notEqual(hashPrediction({ ...prediction, [key]: change }), hash, key);
  }
});

test('the ledger appends new slugs and preserves the original bytes across reruns', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'seedup-predictions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'sealed.jsonl');
  const [first] = appendPredictions(file, [opportunity], now);
  const original = readFileSync(file, 'utf8');
  assert.equal(original, `${JSON.stringify(first)}\n`);
  const changed = { ...opportunity, name: '새 이름' };
  const added = { ...opportunity, slug: 'new' };
  const [second] = appendPredictions(file, [changed, added, added], now + day);
  const updated = readFileSync(file, 'utf8');
  assert.equal(updated, `${original}${JSON.stringify(second)}\n`);
  assert.deepEqual(parseSealedPredictions(updated), [first, second]);
  assert.deepEqual(appendPredictions(file, [changed, added], now + 2 * day), []);
  assert.equal(readFileSync(file, 'utf8'), updated);

  writeFileSync(`${file}.lock`, '');
  assert.throws(() => appendPredictions(file, [opportunity], now), { code: 'EEXIST' });
  assert.equal(readFileSync(file, 'utf8'), updated);
});

test('scoring uses dated direct tools strictly after the seal through the deadline', () => {
  const [sealed] = sealPredictions([opportunity], now);
  Object.freeze(sealed);
  const deadline = now + 5 * day;
  const current: Opportunity = {
    ...opportunity,
    qualified: false,
    supply: [
      ...opportunity.supply,
      tool('2026-11-19T19:00:00+09:00'),
      tool(null),
      tool('2026-11-20T10:00:00Z', 'partial'),
      tool('2026-11-20T10:00:00Z', 'unrelated'),
      tool('2026-11-24T10:00:00.001Z'),
    ],
  };
  const score = (items: Opportunity[], at: number) => scorePredictions([sealed], items, at)[0];
  assert.equal(score([current], deadline - 1).status, 'pending');
  assert.equal(score([current], deadline).status, 'miss');
  assert.equal(score([current], deadline + day).status, 'miss');
  assert.equal(score([], deadline).status, 'miss');

  const beforeDeadline = { ...current, supply: [tool('2026-11-21T10:00:00Z')] };
  assert.equal(score([beforeDeadline], now + day).status, 'pending');
  assert.deepEqual(score([beforeDeadline], now + 2 * day), { ...sealed, status: 'hit' });
  const onDeadline = { ...current, supply: [tool('2026-11-24T10:00:00Z')] };
  assert.deepEqual(score([onDeadline], deadline), { ...sealed, status: 'hit' });
  assert.equal(sealed.hash, hashPrediction(sealed));
});
