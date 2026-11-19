import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setDailyResearchMail } from '../lib/db/onboarding';
import { renderDailyResearchMail } from '../lib/newsletter/daily-research';
import { sendDailyResearchMail } from '../lib/newsletter/opportunity-digest-send';
import { dailyResearch } from '../lib/opportunities/research';
import type { Opportunity, OpportunityPoint } from '../lib/opportunities/types';

const SITE = 'https://seedup.example';
const NOW = Date.parse('2026-11-19T14:30:00Z');
const BEFORE = '2026-11-17T06:00:00Z';
const RECENT = '2026-11-19T06:00:00Z';

function point(at: string, fields: Partial<OpportunityPoint> = {}): OpportunityPoint {
  return { at, evidence: 2, platforms: 2, direct: 0, status: 'open', qualified: false, ...fields };
}

function problem(slug: string, fields: Partial<Opportunity> = {}): Opportunity {
  return {
    slug, name: slug, problem: '', gap: '', keywords: [], status: 'open', qualified: true,
    platforms: ['hn', 'github'], supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0,
    evidence: (['hn', 'github', 'hn'] as const).map((platform, index) => ({
      id: `${slug}-${index}`, platform, quote: `A different stored quote ${index}`, quoteKo: '', url: `${SITE}/post/${index}`, score: 0, postedAt: RECENT,
    })),
    history: [point(RECENT)],
    ...fields,
  };
}

test('renders four capped groups, field trends and one recommendation with escaped HTML links and names', () => {
  const added = Array.from({ length: 4 }, (_, index) => problem(`new-${index}`));
  const changed = Array.from({ length: 4 }, (_, index) => problem(`changed-${index}`, {
    history: [point(BEFORE), point(RECENT, { evidence: 6 - index, direct: 1, status: 'narrowing', qualified: true })],
    keywords: index === 0 ? ['DB', '<cloud>'] : [],
  }));
  added[0] = problem('new & first', { name: '<b>"새 문제" & 팀</b>' });
  const recommendation = { slug: 'picked', name: '<추천> & 팀' };
  const mail = renderDailyResearchMail(dailyResearch([...added, ...changed], NOW), recommendation, `${SITE}/`);
  assert.ok(mail);
  assert.match(mail.subject, /오늘 달라진 것/);
  assert.match(mail.text, /^최근 1일\n/);
  for (const title of ['새로 찾은 문제', '수요 상승', '검증 기준 통과', '빈틈 줄어듦']) {
    const group: string = mail.html.split(`<h2>${title}</h2>`)[1].split('</ul>')[0];
    assert.equal(group.match(/<li>/g)?.length, 3, title);
  }
  assert.doesNotMatch(mail.text + mail.html, /new-3|changed-3/);
  assert.doesNotMatch(mail.html, /<b>|<cloud>|<추천>/);
  assert.match(mail.html, /&lt;b&gt;&quot;새 문제&quot; &amp; 팀&lt;\/b&gt;/);
  assert.match(mail.html, /&lt;추천&gt; &amp; 팀/);
  assert.ok(mail.html.includes(`${SITE}/opportunities/new%20%26%20first`));
  assert.ok(mail.text.includes('분야별 원문 증가\nDB (원문 +4건)\n<cloud> (원문 +4건)'));
  assert.ok(mail.html.includes('<li>&lt;cloud&gt; (원문 +4건)</li>'));
  assert.ok(mail.text.includes(`오늘의 추천 문제\n- <추천> & 팀\n  ${SITE}/opportunities/picked`));
  assert.ok(mail.text.includes(`구독 해지: ${SITE}/profile`));
  assert.ok(mail.html.includes(`<a href="${SITE}/profile">구독 해지</a>`));
});

test('uses the seven-day label for sparse changes and renders nothing for empty history', () => {
  const item = problem('older', { history: [point(BEFORE)] });
  const mail = renderDailyResearchMail(dailyResearch([item], NOW), item, SITE);
  assert.ok(mail);
  assert.ok(mail.text.startsWith('변화가 적어 최근 7일\n'));
  assert.ok(mail.html.includes('<p>변화가 적어 최근 7일</p>'));
  assert.equal(renderDailyResearchMail(dailyResearch([{ ...item, history: [] }], NOW), item, SITE), null);
});

test('the daily setting preserves an existing weekly preference and leaves it off for a new reader', async () => {
  type Row = { user_id: string; newsletter_subscribed: boolean; daily_research_subscribed: boolean; answers?: object };
  const existing = { user_id: 'existing', newsletter_subscribed: true, daily_research_subscribed: false, answers: { preferred_stack: ['React'] } };
  const rows = new Map<string, Row>([[existing.user_id, existing]]);
  const service = {
    from(table: string) {
      assert.equal(table, 'user_onboarding');
      return {
        upsert: (row: Row, options: { onConflict: string; ignoreDuplicates: boolean }) => ({
          select: () => {
            assert.deepEqual(options, { onConflict: 'user_id', ignoreDuplicates: true });
            if (rows.has(row.user_id)) return { data: [] };
            rows.set(row.user_id, row);
            return { data: [{ user_id: row.user_id }] };
          },
        }),
        update: (change: Partial<Row>) => ({ eq: (column: string, id: string) => {
          assert.equal(column, 'user_id');
          rows.set(id, { ...rows.get(id)!, ...change });
          return { error: null };
        } }),
      };
    },
  } as unknown as SupabaseClient;
  await setDailyResearchMail(service, { id: 'existing' }, true);
  assert.equal(rows.get('existing')?.daily_research_subscribed, true);
  assert.equal(rows.get('existing')?.newsletter_subscribed, true);
  assert.equal(rows.get('existing')?.answers, existing.answers);
  await setDailyResearchMail(service, { id: 'new' }, true);
  assert.equal(rows.get('new')?.daily_research_subscribed, true);
  assert.equal(rows.get('new')?.newsletter_subscribed, false);
  await setDailyResearchMail(service, { id: 'new' }, false);
  assert.equal(rows.get('new')?.daily_research_subscribed, false);
});

function fakeMailService() {
  const opportunities = [problem('database', { keywords: ['PostgreSQL'] }), problem('python', { keywords: ['Python'] })];
  const rows = [
    { user_id: 'daily', answers: { preferred_stack: ['Python'] }, daily_research_subscribed: true, newsletter_subscribed: false },
    { user_id: 'weekly', answers: null, daily_research_subscribed: false, newsletter_subscribed: true },
    { user_id: 'unset', answers: null, daily_research_subscribed: null, newsletter_subscribed: true },
  ];
  const claims = new Set(['opportunity-weekly/2026-11-19/daily']);
  const lookedUp: string[] = [];
  const state = { claimsAvailable: true };
  const claimKey = (row: { kind: string; period_key: string; user_id: string }) => `${row.kind}/${row.period_key}/${row.user_id}`;
  const service = {
    from(table: string) {
      if (table === 'opportunities') return { select: () => ({ eq: () => ({ data: opportunities.map((data) => ({ data })) }) }) };
      if (table === 'user_onboarding') return {
        select: () => ({
          eq: (column: 'daily_research_subscribed' | 'newsletter_subscribed', value: boolean) => ({
            order: () => ({ range: (first: number, last: number) => ({ data: rows.filter((row) => row[column] === value).slice(first, last + 1) }) }),
          }),
        }),
      };
      assert.equal(table, 'newsletter_sends');
      return {
        insert: (row: Parameters<typeof claimKey>[0]) => {
          if (!state.claimsAvailable) return { error: { code: '42P01' } };
          const key = claimKey(row);
          if (claims.has(key)) return { error: { code: '23505' } };
          claims.add(key);
          return { error: null };
        },
        delete: () => ({ match: (row: Parameters<typeof claimKey>[0]) => claims.delete(claimKey(row)) }),
      };
    },
    auth: { admin: { getUserById: (id: string) => {
      lookedUp.push(id);
      return { data: { user: { email: `${id}@example.test` } } };
    } } },
  };
  return { service: service as unknown as SupabaseClient, claims, lookedUp, state };
}

test('previews without touching claims, and sends only to opt-ins once per Seoul date', async (t) => {
  const { service, claims, lookedUp, state } = fakeMailService();
  const requests: Array<{ key: string | null; body: { from: string; to: string; text: string } }> = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://api.resend.com/emails');
    requests.push({ key: new Headers(options.headers).get('Idempotency-Key'), body: JSON.parse(String(options.body)) });
    return new Response(null, { status: 200 });
  });
  const input = { service, dryRun: false, siteUrl: SITE, resendKey: 'fake-resend-key', from: 'Seedup <mail@example.test>' };
  const preview = await sendDailyResearchMail({ ...input, resendKey: undefined, dryRun: true }, NOW);
  assert.equal(preview.recipients, 1);
  assert.match(preview.mail?.text ?? '', /오늘의 추천 문제\n- database/);
  assert.deepEqual(lookedUp, []);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(claims.size, 1);

  const first = await sendDailyResearchMail(input, NOW);
  assert.equal(first.sent, 1);
  assert.equal((await sendDailyResearchMail(input, NOW + 15 * 60_000)).duplicates, 1);
  assert.deepEqual(lookedUp, ['daily', 'daily']);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(requests[0].body.to, 'daily@example.test');
  assert.equal(requests[0].body.from, input.from);
  assert.match(requests[0].body.text, /오늘의 추천 문제\n- python/);
  assert.equal(requests[0].key, 'opportunity-daily-2026-11-19-daily');

  state.claimsAvailable = false;
  const afterMidnight = NOW + 35 * 60_000;
  assert.equal((await sendDailyResearchMail(input, afterMidnight)).failed, 1);
  assert.equal(fetchMock.mock.callCount(), 1);
  state.claimsAvailable = true;
  assert.equal((await sendDailyResearchMail(input, afterMidnight)).sent, 1);
  assert.equal(requests[1].key, 'opportunity-daily-2026-11-20-daily');
});
