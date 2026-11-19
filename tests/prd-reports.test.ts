import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/spec/[id]/report/route';
import { isReportId, readPrdReport } from '../lib/opportunities/prd-report-input';

test('reports require a valid UUID, allowed reason and one short line of text', () => {
  assert.ok(isReportId('00000000-0000-0000-0000-000000000001'));
  assert.equal(isReportId('a'.repeat(36)), false);
  assert.deepEqual(readPrdReport({ reason: 'spam', note: ' A duplicate ad. ' }), { reason: 'spam', note: 'A duplicate ad.' });
  assert.equal(readPrdReport({ reason: '__proto__', note: 'Reason' }), null);
  assert.equal(readPrdReport({ reason: 'other', note: 'First\nSecond' }), null);
  assert.equal(readPrdReport({ reason: 'other', note: 'a'.repeat(201) }), null);
});

test('anonymous submissions are rate-limited before accessing auth or the database', async () => {
  const send = (address: string) => POST(new Request('https://example.test/api/spec/bad/report', {
    method: 'POST', headers: { 'cf-connecting-ip': address, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'spam', note: 'Ad' }),
  }), { params: Promise.resolve({ id: 'bad' }) });
  for (let count = 0; count < 6; count++) assert.equal((await send('192.0.2.36')).status, 404);
  const limited = await send('192.0.2.36');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal((await send('192.0.2.37')).status, 404);
});
