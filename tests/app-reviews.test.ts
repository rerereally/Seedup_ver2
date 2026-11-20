import assert from 'node:assert/strict';
import test from 'node:test';
import { searchAppReviews } from '../lib/opportunities/app-reviews';

const APP_URL = 'https://apps.apple.com/us/app/example/id123';
const LONG = 'The app keeps logging me out every time I switch between my two devices, which is maddening.';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const fakeFetch = (feedEntry: unknown) => (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/search')) return json({ results: [{ trackId: 123, trackName: 'Example', trackViewUrl: `${APP_URL}?uo=4` }] });
  return json({ feed: { entry: feedEntry } });
}) as unknown as typeof fetch;

const entries = [
  { title: { label: 'Makes sense' }, content: { label: 'App info, no rating here at all.' } },
  { title: { label: 'Great' }, content: { label: LONG }, 'im:rating': { label: '5' } },
  { title: { label: 'Logs me out' }, content: { label: `  ${LONG}\n\n  Really   annoying.  ` }, 'im:rating': { label: '2' }, 'im:voteSum': { label: '12' }, updated: { label: '2026-10-01T00:00:00-07:00' } },
  { title: { label: 'Meh' }, content: { label: 'Fine, short.' }, 'im:rating': { label: '3' } },
];

test('keeps only 1 to 3 star reviews with enough text, from the app URL without query string', async () => {
  const result = await searchAppReviews('log out', { fetcher: fakeFetch(entries) });
  assert.equal(result.length, 1);
  assert.equal(result[0].platform, 'web');
  assert.equal(result[0].url, APP_URL);
  assert.equal(result[0].title, 'Example review: Logs me out');
  assert.equal(result[0].score, 12);
  assert.equal(result[0].postedAt, '2026-10-01T00:00:00-07:00');
  assert.ok(!result[0].text.includes('\n'));
});

test('a rejected fetch yields an empty list instead of throwing', async () => {
  const fetcher = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.deepEqual(await searchAppReviews('log out', { fetcher }), []);
});

test('accepts a single entry object in place of an array', async () => {
  const single = { title: { label: 'Broken' }, content: { label: LONG }, 'im:rating': { label: '1' } };
  const result = await searchAppReviews('log out', { fetcher: fakeFetch(single) });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Example review: Broken');
  assert.equal(result[0].score, 0);
  assert.equal(result[0].postedAt, null);
});
