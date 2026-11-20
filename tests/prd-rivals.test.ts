import assert from 'node:assert/strict';
import test from 'node:test';
import { groundRivalComparisons } from '../lib/opportunities/prd-rivals';

test('rival comparison fills omitted limits from listings and drops invented limits and names', () => {
  const input = {
    competitors: ['Exporter', 'Transcriber', 'Tracker', 'Promo', 'Unknown'],
    competitorNotes: [
      'Exporter: Turn notes into a report. It only supports CSV.',
      'Transcriber: Offline processing is unsupported.',
      'Tracker: Stores activity on a dashboard.',
      'Promo: The only CLI built for busy teams.',
      'Other: Supports Google Drive only.',
    ],
  };
  const rivals = groundRivalComparisons([
    { name: 'exporter', misses: 'It does not support PDF.', answer: 'Build a PDF export.' },
    { name: 'tracker', misses: 'It does not export activity.', answer: 'Build an export.' },
    { name: 'Other', misses: 'Supports Google Drive only.', answer: 'Support additional sources.' },
  ], input, 'en');
  assert.deepEqual(rivals.slice(0, 2), [
    { name: 'Exporter', misses: 'It only supports CSV.', answer: '' },
    { name: 'Transcriber', misses: 'Offline processing is unsupported.', answer: '' },
  ]);
  assert.deepEqual(rivals.slice(2).map(({ name, answer }) => ({ name, answer })), [
    { name: 'Tracker', answer: '' }, { name: 'Promo', answer: '' }, { name: 'Unknown', answer: '' },
  ]);
  assert.ok(rivals.slice(2).every(({ misses }) => misses.startsWith('Not compared yet')));
});

test('a proposed answer stays when its limitation matches the listing, even on a repeated pass', () => {
  const input = { competitors: ['보고 도구'], competitorNotes: ['보고 도구: PDF만 지원합니다.'] };
  const rivals = [{ name: '보고 도구', misses: 'PDF만 지원합니다.', answer: 'CSV도 내보낼 수 있게 합니다.' }];
  assert.deepEqual(groundRivalComparisons(rivals, input), rivals);
});
