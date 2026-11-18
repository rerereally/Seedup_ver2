import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOpportunityDigest } from '../lib/newsletter/opportunity-digest';
import type { Opportunity } from '../lib/opportunities/types';

const opportunity = (slug: string, quote: string) => ({
  slug, name: `Name ${slug}`, problem: 'A problem', gap: '', keywords: [], status: 'open', qualified: true, platforms: ['hn', 'github'], supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0,
  evidence: [{ id: `${slug}1`, platform: 'hn', quote, quoteKo: '', url: 'https://news.example/1', score: 3, postedAt: '2026-11-10T00:00:00Z' }],
  history: [{ at: '2026-11-15T00:00:00Z', evidence: 3, platforms: 2, direct: 0, status: 'open', qualified: true }],
}) as Opportunity;

test('the weekly issue carries curated reads, a readable quote and an unsubscribe link', () => {
  const reads = [{ title: 'A paper worth reading', href: '/papers/1', source: '논문', reason: 'AI 관심사와 맞습니다' }];
  const issue = buildOpportunityDigest([opportunity('a', 'every time I switch providers I rewrite large parts of my code')], '2026-11-09T00:00:00Z', 'https://seedup.example', 'weekly', Date.parse('2026-11-16T00:00:00Z'), undefined, reads)!;
  assert.equal(issue.reads.length, 1);
  assert.equal(issue.top[0].quote?.text, 'every time I switch providers I rewrite large parts of my code');
  assert.ok(issue.html.includes('https://seedup.example/papers/1'));
  assert.ok(issue.html.includes('구독 해지'));
  assert.ok(!/text-transform:uppercase|border-radius:999/.test(issue.html));
  assert.ok(issue.text.includes('읽을거리'));
});

test('fragments are never shown as the quote, and alerts never carry reads', () => {
  const fragment = buildOpportunityDigest([opportunity('b', 'Amazon Bedrock does not provide an API that returns:')], '2026-11-09T00:00:00Z', 'https://x.test', 'weekly')!;
  assert.equal(fragment.top[0].quote, null);
  const alert = buildOpportunityDigest([opportunity('c', 'a sentence long enough to be a quote here')], '2026-11-09T00:00:00Z', 'https://x.test', 'changes', Date.now(), undefined, [{ title: 't', href: '/x', source: 's', reason: null }])!;
  assert.equal(alert.reads.length, 0);
});

import { webhookKind, webhookPayload } from '../lib/newsletter/webhooks';

test('only Discord and Slack webhook addresses are accepted, so the server cannot be pointed elsewhere', () => {
  assert.equal(webhookKind('https://discord.com/api/webhooks/123456/abc-DEF_9'), 'discord');
  assert.equal(webhookKind('https://hooks.slack.com/services/T000/B000/XXXX'), 'slack');
  for (const bad of ['http://discord.com/api/webhooks/1/a', 'https://discord.com.evil.test/api/webhooks/1/a', 'https://example.com/hook', 'https://hooks.slack.com/services/x?y=1', '']) assert.equal(webhookKind(bad), null, bad);
});

test('a Discord message stays under its 2,000-character cap', () => {
  const payload = webhookPayload('discord', 'subject', 'x'.repeat(3000)) as { content: string };
  assert.ok(payload.content.length <= 1990);
  assert.deepEqual(Object.keys(webhookPayload('slack', 's', 't')), ['text']);
});
