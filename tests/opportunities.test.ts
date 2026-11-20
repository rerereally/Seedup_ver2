import assert from 'node:assert/strict';
import test from 'node:test';
import { matchOpportunities, quoteMentions, rankBySimilarity } from '../lib/opportunities/match';
import { mermaidFlow, normalizeSlots, normalizeSpec, renderAgentBrief, renderSpecMarkdown, traceOf } from '../lib/opportunities/spec';
import { specInputFor } from '../lib/opportunities/context';
import { classifySupply, cosineSimilarity, countFollowers, isVerbatimQuote, meetsEvidenceBar, toSlug } from '../lib/opportunities/rules';
import { stackSiteOf } from '../lib/opportunities/actors';
import type { Evidence, SupplyItem } from '../lib/opportunities/types';

const supply = (relation: SupplyItem['relation'], popularity = 0, createdAt: string | null = null): SupplyItem => ({ kind: 'github', name: 'x', description: '', popularity, url: 'u', createdAt, relation });
const evidence = (n: number): Evidence => ({ id: `ev${n}`, platform: 'hn', quote: `quote ${n}`, quoteKo: '', url: `https://example.com/${n}`, score: 0, postedAt: null });

test('accepts a quote only when it appears in the source', () => {
  const source = 'We ended up building our own “deploy” tool because nothing fit.';
  assert.equal(isVerbatimQuote('ended up building our own deploy tool', source), true);
  assert.equal(isVerbatimQuote('we wrote a custom deployment product', source), false);
  assert.equal(isVerbatimQuote('short', source), false);
});

test('evidence bar needs both volume and platform diversity', () => {
  assert.equal(meetsEvidenceBar(3, 2), true);
  assert.equal(meetsEvidenceBar(9, 1), false);
  assert.equal(meetsEvidenceBar(2, 2), false);
});

test('classifies how crowded a market is', () => {
  assert.equal(classifySupply([], false), 'unknown');
  assert.equal(classifySupply([supply('partial')], true), 'open');
  assert.equal(classifySupply([supply('direct', 2_500)], true), 'narrowing');
  assert.equal(classifySupply([supply('direct', 48_000)], true), 'closed');
  assert.equal(classifySupply(Array.from({ length: 8 }, () => supply('direct')), true), 'closed');
  // An app with many store ratings crowds a market the way a starred repo does; ratings are not read as stars.
  assert.equal(classifySupply([{ ...supply('direct', 6_000), kind: 'appstore' }], true), 'narrowing');
  assert.equal(classifySupply([{ ...supply('direct', 280_000), kind: 'appstore' }], true), 'closed');
  assert.equal(classifySupply([{ ...supply('direct', 1_500), kind: 'appstore' }], true), 'open');
});

test('reads the Stack Exchange site from a question link', () => {
  assert.equal(stackSiteOf('https://workplace.stackexchange.com/questions/1/x'), 'workplace');
  assert.equal(stackSiteOf('https://stackoverflow.com/questions/1/x'), null);
  assert.equal(stackSiteOf('https://news.ycombinator.com/item?id=1'), null);
});

test('counts only related tools that appeared after the first complaint', () => {
  const items = [supply('direct', 0, '2026-06-01'), supply('partial', 0, '2025-01-01'), supply('unrelated', 0, '2026-07-01'), supply('direct')];
  assert.equal(countFollowers(items, '2026-01-01'), 1);
  assert.equal(countFollowers(items, null), 0);
});

test('slug falls back when the model gives nothing usable', () => {
  assert.equal(toSlug('Agent Memory!', 'x'), 'agent-memory');
  assert.equal(toSlug('한글만', 'fallback'), 'fallback');
});

test('cosine similarity rejects mismatched vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [1]), 0);
});

const items = [
  { slug: 'rules', name: '코딩 에이전트 규칙 강제', keywords: ['규칙', 'rule', '가이드'] },
  { slug: 'ci', name: '홈랩용 로컬 CI', keywords: ['ci', '빌드', 'deploy'] },
];

test('matches Korean words that carry particles', () => {
  assert.deepEqual(matchOpportunities('규칙을 지키게 하는 것', items).slugs, ['rules']);
});

test('short Latin keywords need an exact word', () => {
  assert.deepEqual(matchOpportunities('ci', items).slugs, ['ci']);
  assert.deepEqual(matchOpportunities('social', items).slugs, []);
});

test('generic words do not select a candidate alone', () => {
  assert.deepEqual(matchOpportunities('도구', items).slugs, []);
  assert.equal(quoteMentions(['agent'], 'an agent failed'), false);
  assert.equal(quoteMentions(['rollback'], 'we need rollback'), true);
});

test('unfinished Hangul composition is ignored', () => {
  assert.equal(matchOpportunities('ㄱㅠ', items).active, false);
});

test('semantic ranking keeps only strong, nearby matches', () => {
  const scores = [{ slug: 'a', score: 0.6 }, { slug: 'b', score: 0.57 }, { slug: 'c', score: 0.4 }];
  assert.deepEqual(rankBySimilarity(scores, 0.3, 0.06, 5), ['a', 'b']);
  assert.deepEqual(rankBySimilarity(scores, 0.7, 0.06, 5), []);
});

test('PRD requirements without valid citations become hypotheses', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [
      { title: 'cited', detail: 'd', evidence: [1, 1, 2] },
      { title: 'invented citation', detail: 'd', evidence: [99] },
      { title: 'no citation', detail: 'd', evidence: [] },
      { title: '', detail: 'dropped', evidence: [1] },
    ],
  }, 3);
  assert.deepEqual(spec.requirements.map((row) => [row.id, row.title]), [['R-01', 'cited']]);
  assert.deepEqual(spec.requirements[0].evidence, [1, 2]);
  assert.deepEqual(spec.hypotheses.map((row) => [row.id, row.title]), [['H-01', 'invented citation'], ['H-02', 'no citation']]);
});

test('features must serve a kept requirement and screens a kept feature, so nothing floats free of the evidence', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [{ title: 'real', detail: 'd', evidence: [1] }, { title: 'guess', detail: 'd', evidence: [] }],
    features: [
      { title: 'serves real', requirements: [1] },
      { title: 'serves only a hypothesis', requirements: [2] },
      { title: 'serves nothing', requirements: [7] },
    ],
    screens: [
      { name: 'home', features: [1] },
      { name: 'orphan', features: [2] },
      { name: 'no features' },
    ],
  }, 1);
  assert.deepEqual(spec.features.map((row) => [row.id, row.title, row.requirementIds]), [['F-01', 'serves real', ['R-01']]]);
  assert.deepEqual(spec.screens.map((row) => [row.id, row.name, row.featureIds]), [['S-01', 'home', ['F-01']]]);
});

test('tracing an item lights up its whole chain both ways', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [{ title: 'a', evidence: [1] }, { title: 'b', evidence: [2] }],
    features: [{ title: 'fa', requirements: [1] }, { title: 'fb', requirements: [2] }],
    screens: [{ name: 'sa', features: [1] }, { name: 'sb', features: [2] }],
  }, 2);
  const fromScreen = traceOf(spec, 'S-01');
  assert.deepEqual([...fromScreen.ids].sort(), ['F-01', 'R-01', 'S-01']);
  assert.deepEqual([...fromScreen.evidence], [1]);
  const fromQuote = traceOf(spec, 'E-2');
  assert.ok(fromQuote.ids.has('R-02') && fromQuote.ids.has('F-02') && fromQuote.ids.has('S-02'));
  assert.ok(!fromQuote.ids.has('R-01'));
});

test('readiness slots keep only the six known keys and reject empty answers', () => {
  assert.equal(normalizeSlots(null), null);
  assert.equal(normalizeSlots({ inputs: [], rules: '' }), null);
  const slots = normalizeSlots({ inputs: ['a'], done: ['b', ''], extra: ['x'] });
  assert.deepEqual(slots, { inputs: ['a'], rules: [], errors: [], access: [], data: [], done: ['b'] });
});

test('exports keep source links, carry slots, and keep hypotheses out of the build list', () => {
  const input = { title: 'T', problem: 'P', gap: 'G', evidence: [evidence(1)], competitors: ['c'] };
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'real', detail: 'd', evidence: [1] }, { title: 'guess', detail: 'd', evidence: [] }], features: [{ title: 'build it', requirements: [1] }], screens: [{ name: 'Home "page"', features: [1] }] }, 1);
  spec.features[0].slots = { inputs: ['email'], rules: [], errors: [], access: [], data: [], done: ['test passes'] };
  const markdown = renderSpecMarkdown(input, spec);
  assert.match(markdown, /근거: E-1/);
  assert.match(markdown, /https:\/\/example\.com\/1/);
  assert.match(markdown, /```mermaid/);
  for (const format of ['agents', 'claude', 'cursor'] as const) {
    const brief = renderAgentBrief(input, spec, format);
    assert.match(brief, format === 'agents'
      ? /call resume_project with the project key before working, then get_next_task with the opportunity slug/
      : /call get_next_task with the opportunity slug at the start of each session/);
    assert.match(brief, /- \[ \] F-01 build it/);
    assert.match(brief, /inputs: email/);
    assert.match(brief, /data: \(open question\)/);
    assert.doesNotMatch(brief, /- \[ \] .*guess/);
  }
  assert.doesNotMatch(mermaidFlow(spec), /"Home "page""/);
});

test('a draft spec is labeled as a hypothesis draft in every export', () => {
  const input = { title: 'T', problem: 'P', gap: '', evidence: [evidence(1)], competitors: [] };
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'r', evidence: [1] }] }, 1, true);
  assert.match(renderSpecMarkdown(input, spec), /가설 초안/);
  assert.match(renderAgentBrief(input, spec), /HYPOTHESIS DRAFT/);
});

import { dossierChanges, dossierHref, koreaLens, scoreOpportunity, stackFit, trackRecord, whyNow } from '../lib/opportunities/insight';
import { describeChange } from '../lib/opportunities/merge';
import type { Opportunity } from '../lib/opportunities/types';

const NOW = new Date('2026-11-01T00:00:00Z').getTime();
const sample = (over: Partial<Opportunity> = {}): Opportunity => ({
  slug: 's', name: '스키마 정규화', problem: 'LLM 제공자마다 스키마가 다르다', gap: '', keywords: ['llm', '스키마', 'openai'], status: 'open', qualified: true,
  platforms: ['hn', 'github'],
  evidence: [
    { id: 'a', platform: 'hn', quote: 'no good way to normalize schemas across providers', quoteKo: '', url: 'u1', score: 40, postedAt: '2026-09-01T00:00:00Z' },
    { id: 'b', platform: 'github', quote: 'we had to write our own postgres adapter', quoteKo: '', url: 'u2', score: 10, postedAt: '2026-01-01T00:00:00Z' },
    { id: 'c', platform: 'hn', quote: 'tired of manually patching this', quoteKo: '', url: 'u3', score: 0, postedAt: null },
  ],
  supply: [
    { kind: 'github', name: 'late/tool', description: '', popularity: 50, url: 't1', createdAt: '2026-03-01T00:00:00Z', relation: 'direct' },
    { kind: 'github', name: 'early/tool', description: '', popularity: 50, url: 't2', createdAt: '2025-01-01T00:00:00Z', relation: 'partial' },
  ],
  directCount: 1, firstSeenAt: '2026-01-01T00:00:00Z', followersAfterSignal: 1, ...over,
});

test('score parts add up to the total and stay within their maximums', () => {
  const score = scoreOpportunity(sample(), NOW);
  assert.equal(score.total, score.parts.reduce((sum, part) => sum + part.points, 0));
  assert.ok(score.parts.every((part) => part.points >= 0 && part.points <= part.max));
  assert.equal(score.parts.reduce((sum, part) => sum + part.max, 0), 100);
  assert.ok(scoreOpportunity(sample({ status: 'closed' }), NOW).total < score.total);
  assert.equal(scoreOpportunity(sample({ evidence: [], platforms: [] }), NOW).parts.find((part) => part.key === 'recency')?.points, 0);
});

test('why-now puts voices and tools on one axis and counts what came after', () => {
  const timing = whyNow(sample(), NOW);
  assert.deepEqual(timing.events.map((event) => event.url), ['t2', 'u2', 't1', 'u1']);
  assert.equal(timing.recentVoices, 1);
  assert.equal(timing.toolsAfterFirstVoice, 1);
});

test('track record lists only tools made after the first complaint', () => {
  const rows = trackRecord([sample(), sample({ slug: 'none', supply: [] }), sample({ slug: 'undated', firstSeenAt: null })]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].followers.map((tool) => tool.name), ['late/tool']);
  assert.equal(rows[0].followers[0].leadDays, 59);
});

test('stack fit matches profile choices against the opportunity text', () => {
  const fit = stackFit(sample(), ['LLM API', 'PostgreSQL', 'Spring', '아직 모르겠음']);
  assert.deepEqual(fit.matched, ['LLM API', 'PostgreSQL']);
  assert.equal(fit.chosen, 3);
  assert.equal(stackFit(sample(), []).level, 'none');
});

test('korea lens searches with one English and one Korean keyword', () => {
  const lens = koreaLens(sample());
  assert.equal(lens.query, 'llm 스키마');
  assert.ok(lens.places.every((place) => place.href.includes(encodeURIComponent('llm 스키마'))));
});

test('dossier changes report added and removed evidence and later status moves', () => {
  const history = [
    { at: '2026-10-01T00:00:00Z', evidence: 2, platforms: 2, direct: 0, status: 'open' as const, qualified: false },
    { at: '2026-10-20T00:00:00Z', evidence: 3, platforms: 2, direct: 3, status: 'narrowing' as const, qualified: true },
  ];
  const changes = dossierChanges(['a', 'gone'], '2026-10-05T00:00:00Z', sample({ history }), describeChange);
  assert.equal(changes.added.length, 2);
  assert.equal(changes.removed, 1);
  assert.equal(changes.notes.length, 3);
  assert.equal(dossierChanges(['a', 'b', 'c'], '2026-10-25T00:00:00Z', sample({ history }), describeChange).notes.length, 0);
});

test('a saved PRD reopens its opportunity, else its surviving quotes, else bookmarks', () => {
  const list = [sample()];
  assert.equal(dossierHref({ opportunity_slug: 's', evidence_ids: [] }, list), '/prd?opportunity=s');
  assert.equal(dossierHref({ opportunity_slug: 'gone', evidence_ids: ['a', 'x', 'c'] }, list), `/prd?evidence=${encodeURIComponent('a,c')}`);
  assert.equal(dossierHref({ opportunity_slug: null, evidence_ids: ['x'] }, list), '/scrap');
});

test('a PRD built from quotes of several opportunities carries all of their context, led by the most-picked one', () => {
  const one = sample({ slug: 'one', name: 'One', problem: 'problem one', gap: 'gap one' });
  const two = sample({
    slug: 'two', name: 'Two', problem: 'problem two', gap: 'gap two',
    supply: [{ kind: 'npm', name: 'rival', description: '', popularity: 1, url: 'r', createdAt: null, relation: 'direct' }, { kind: 'github', name: 'late/tool', description: '', popularity: 1, url: 't1', createdAt: null, relation: 'direct' }],
  });
  const picked = [
    { evidence: two.evidence[0], slug: 'two' },
    { evidence: one.evidence[0], slug: 'one' },
    { evidence: two.evidence[1], slug: 'two' },
  ];
  const input = specInputFor([one, two], picked);
  assert.ok(input);
  assert.equal(input!.title, 'Two');
  assert.match(input!.problem, /^problem two/);
  assert.match(input!.problem, /problem one/);
  assert.match(input!.gap, /gap two/);
  assert.match(input!.gap, /gap one/);
  assert.deepEqual(input!.competitors, ['rival', 'late/tool']);
  assert.equal(input!.evidence.length, 3);
  assert.equal(specInputFor([one, two], []), null);
});

import { buildOpportunityDigest, readerInterest } from '../lib/newsletter/opportunity-digest';

test('each reader sees their own opportunities first in the digest', () => {
  const history = [
    { at: '2026-10-01T00:00:00Z', evidence: 1, platforms: 1, direct: 0, status: 'open' as const, qualified: false },
    { at: '2026-11-13T00:00:00Z', evidence: 4, platforms: 2, direct: 0, status: 'open' as const, qualified: true },
  ];
  const a = sample({ slug: 'a', name: 'Alpha', keywords: ['rust'], history });
  const b = sample({ slug: 'b', name: 'Beta', keywords: ['postgres'], history });
  const since = '2026-11-01T00:00:00Z';
  const plain = buildOpportunityDigest([a, b], since, 'https://x.test', 'changes')!;
  assert.equal(plain.lines[0].slug, 'a');
  const saved = buildOpportunityDigest([a, b], since, 'https://x.test', 'changes', Date.now(), { slugs: ['b'], keywords: [] })!;
  assert.equal(saved.lines[0].slug, 'b');
  assert.match(saved.lines[0].note, /^관심 기회/);
  assert.match(saved.subject, /Beta/);
  const interest = readerInterest([a, b], { slugs: [], keywords: ['Postgres'] });
  assert.equal(interest('b'), 1);
  assert.equal(interest('a'), 0);
});

test('a reverse spec keeps the repo structure it found and passes it to the coding-agent export', () => {
  const input = { title: 'repo 역기획', problem: 'P', gap: '', evidence: [evidence(1)], competitors: [] };
  const spec = normalizeSpec({ summary: 's', existing: [{ name: 'CLI', does: 'runs jobs' }, { name: '' }], requirements: [{ title: 'r', evidence: [1] }], features: [{ title: 'f', requirements: [1] }] }, 1);
  assert.deepEqual(spec.existing, [{ name: 'CLI', does: 'runs jobs' }]);
  assert.match(renderSpecMarkdown(input, spec), /## 기존 구조 \(역기획\)[\s\S]*\*\*CLI\*\*/);
  assert.match(renderAgentBrief(input, spec), /## Existing structure \(keep it working\)\n- CLI: runs jobs/);
  assert.equal(normalizeSpec({ summary: 's' }, 0).existing, undefined);
});

test('an English spec renders English headings and drops the Korean translation of quotes', () => {
  const input = { title: 'T', problem: 'P', gap: '', evidence: [{ ...evidence(1), quoteKo: '번역' }], competitors: [] };
  const spec = { ...normalizeSpec({ summary: 's', requirements: [{ title: 'r', evidence: [1] }], features: [{ title: 'f', requirements: [1] }] }, 1), lang: 'en' as const };
  const markdown = renderSpecMarkdown(input, spec);
  assert.match(markdown, /## Requirements \(evidence → R\)/);
  assert.match(markdown, /Evidence: E-1/);
  assert.doesNotMatch(markdown, /번역/);
});

import { trackRecordSummary } from '../lib/opportunities/insight';

test('the track record headline counts hits and the median head start', () => {
  const rows = [
    { slug: 'a', name: 'A', firstSeenAt: '2026-01-01', followers: [{ name: 't', url: 'u1', createdAt: '2026-02-01', leadDays: 31 }, { name: 't2', url: 'u2', createdAt: '2026-05-01', leadDays: 120 }] },
    { slug: 'b', name: 'B', firstSeenAt: '2026-01-01', followers: [{ name: 't', url: 'u3', createdAt: '2026-01-11', leadDays: 10 }] },
    { slug: 'c', name: 'C', firstSeenAt: '2026-01-01', followers: [{ name: 't', url: 'u4', createdAt: '2026-03-02', leadDays: 60 }] },
  ];
  assert.deepEqual(trackRecordSummary(rows, 10), { hits: 3, total: 10, rate: 30, tools: 4, medianLeadDays: 31, maxLeadDays: 120 });
  assert.deepEqual(trackRecordSummary([], 0), { hits: 0, total: 0, rate: 0, tools: 0, medianLeadDays: 0, maxLeadDays: 0 });
});

import { localizedOpportunity } from '../lib/opportunities/types';

test('English mode uses the English copies and falls back to Korean when they are missing', () => {
  const withEnglish = { name: '이름', problem: '문제', gap: '빈틈', nameEn: 'Name', problemEn: 'Problem', gapEn: '' };
  assert.deepEqual(localizedOpportunity(withEnglish, 'en'), { name: 'Name', problem: 'Problem', gap: '빈틈' });
  assert.deepEqual(localizedOpportunity(withEnglish, 'ko'), { name: '이름', problem: '문제', gap: '빈틈' });
  const input = specInputFor([sample({ slug: 'x', nameEn: 'Schema', problemEn: 'Schemas differ' })], [{ evidence: sample().evidence[0], slug: 'x' }], '', 'en');
  assert.equal(input?.title, 'Schema');
  assert.equal(input?.problem, 'Schemas differ');
});

import { clusterByEmbedding, isListable } from '../lib/opportunities/rules';
import { pageWindow } from '../lib/opportunities/web';

test('pains close in meaning share a group and distant ones do not, with pass-2 centroid refinement preventing drift chaining', () => {
  const groups = clusterByEmbedding([[1, 0, 0], [0.95, 0.1, 0], [0, 1, 0], [0.9, 0, 0.1], [0, 0.97, 0.2]], 0.8);
  assert.deepEqual(groups, [[0, 1, 3], [2, 4]]);
  assert.deepEqual(clusterByEmbedding([], 0.8), []);

  // A gradual 5-vector chain where pass 1 merges all 5 into one drifting group, and pass 2 splits index 0 out.
  const chain = [
    [1, 0],
    [0.85, 0.526],
    [0.7, 0.714],
    [0.6, 0.8],
    [0.55, 0.835],
  ];
  const refined = clusterByEmbedding(chain, 0.84);
  assert.equal(refined.length, 2);
  assert.deepEqual(refined[0], [0]);
  assert.deepEqual(refined[1], [1, 2, 3, 4]);
});

test('one quote is never listed', () => {
  assert.equal(isListable({ evidence: [1] }), false);
  assert.equal(isListable({ evidence: [1, 2] }), true);
});

test('a page window keeps the passage the search snippet came from', () => {
  const page = `${'menu '.repeat(500)}We still copy invoices into the spreadsheet by hand every week. ${'footer '.repeat(500)}`;
  const window = pageWindow(page, 'We still copy invoices into the spreadsheet by hand');
  assert.ok(window.includes('We still copy invoices into the spreadsheet by hand every week.'));
  assert.ok(pageWindow('short page', 'not there').startsWith('short page'));
});

import { forumHostOf, forumPostText } from '../lib/opportunities/actors';

test('forum posts drop the replies they quote and are recognised by host', () => {
  const raw = '[quote="alice, post:3, topic:9"]\nI love it\n[/quote]\nIs there a tool that exports this?';
  assert.equal(forumPostText(raw), 'Is there a tool that exports this?');
  assert.equal(forumPostText('<aside class="quote" data-post="2"><blockquote>theirs</blockquote></aside><p>mine</p>'), 'mine');
  assert.equal(forumHostOf('https://forum.cursor.com/t/x/1/2'), 'forum.cursor.com');
  assert.equal(forumHostOf('https://example.com/t/x/1/2'), null);
});

import { tidyName } from '../lib/opportunities/names';

test('opportunity names get standard casing and known term fixes, nothing else', () => {
  assert.equal(tidyName('gif 검색 api 대안'), 'GIF 검색 API 대안');
  assert.equal(tidyName('메시 브레프 변환'), '메시 B-rep 변환');
  assert.equal(tidyName('ai 라텍스 렌더링 오류'), 'AI LaTeX 렌더링 오류');
  assert.equal(tidyName('github ios 앱'), 'GitHub iOS 앱');
  assert.equal(tidyName('Agent guardrails for databases'), 'Agent guardrails for databases');
});

import { exportFormatOrder, isBeginner, preferredExportFormat } from '../lib/onboarding';

test('the builder prompt carries backed features and quotes, and the Cursor rule has front matter', () => {
  const input = { title: 'T', problem: 'P', gap: '', evidence: [evidence(1), evidence(2)], competitors: [] };
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'real', evidence: [1] }, { title: 'guess', evidence: [] }], features: [{ title: 'build it', requirements: [1] }] }, 2);
  const prompt = renderAgentBrief(input, spec, 'prompt');
  assert.match(prompt, /F-01 build it/);
  assert.match(prompt, /"quote 1"/);
  assert.doesNotMatch(prompt, /guess|E-\d|```mermaid/);
  assert.match(renderAgentBrief(input, spec, 'cursor'), /^---\ndescription: .*\nalwaysApply: true\n---/);
});

test('only 입문자 and 초보자 count as beginners', () => {
  assert.equal(isBeginner({ level: '입문자: 개발을 막 시작했어요' }), true);
  assert.equal(isBeginner({ level: ['초보자: 간단한 프로젝트는 만들 수 있어요'] }), true);
  assert.equal(isBeginner({ level: '중급자: 서비스 구조와 배포까지 어느 정도 알아요' }), false);
  assert.equal(isBeginner(null), false);
});

test('preferredExportFormat maps onboarding tool choices to the primary PRD export button and folds the rest', () => {
  assert.equal(preferredExportFormat({ preferred_tool: 'Cursor' }), 'cursor');
  assert.equal(preferredExportFormat({ preferred_tool: 'Claude Code' }), 'claude');
  assert.equal(preferredExportFormat({ preferred_tool: 'Lovable · Bolt · v0' }), 'prompt');
  assert.equal(preferredExportFormat({ preferred_tool: 'Codex · Antigravity · VS Code' }), 'agents');
  assert.equal(preferredExportFormat({ preferred_tool: '아직 없음' }), null);
  assert.equal(preferredExportFormat(null), null);

  assert.deepEqual(exportFormatOrder(preferredExportFormat({ preferred_tool: 'Cursor' })), {
    primary: 'cursor',
    others: ['agents', 'claude', 'prompt'],
    hasPreference: true,
  });
  assert.deepEqual(exportFormatOrder(null), {
    primary: 'agents',
    others: ['claude', 'cursor', 'prompt'],
    hasPreference: false,
  });
});

import { normalizeBuild } from '../lib/opportunities/build';

test('a build estimate keeps only a known size, days inside that size, and short lists', () => {
  assert.equal(normalizeBuild({ size: 'month' }), null);
  assert.equal(normalizeBuild(null), null);
  assert.deepEqual(normalizeBuild({ size: 'weekend', days: 20, stack: ['Next.js', '', 'Supabase', 'a', 'b'], hard: ['결제'] }), { size: 'weekend', days: 3, stack: ['Next.js', 'Supabase', 'a', 'b'], hard: ['결제'] });
  assert.equal(normalizeBuild({ size: 'team', days: 'x' })?.days, 31);
});

import { interestTokens, profileText, reasonFor } from '../lib/personal';

test('the personal profile uses real answers only and names a matching interest as the reason', () => {
  const answers = { interests: ['AI/LLM', '잘 모르겠음'], preferred_stack: ['Next.js', 'Supabase'], level: '초보자: 간단한 프로젝트는 만들 수 있어요' };
  assert.deepEqual(interestTokens(answers), ['AI/LLM', 'Next.js', 'Supabase']);
  assert.equal(profileText(null, [], []), '');
  assert.match(profileText(answers, ['repo a'], ['plan b']), /관심: AI\/LLM, Next\.js, Supabase\n만들고 있는 것: plan b\n킵한 것: repo a/);
  assert.equal(reasonFor('A Supabase starter', ['AI/LLM', 'Supabase'], false), '관심 분야 Supabase');
  assert.equal(reasonFor('LLM routing', ['AI/LLM'], false), '관심 분야 AI/LLM');
  assert.equal(reasonFor('nothing here', ['Rust'], true), '킵한 것과 비슷함');
});

import { mixByKind } from '../lib/personal';

test('the for-you list takes the best of each kind in turn', () => {
  const row = (kind: string, score: number) => ({ key: `${kind}${score}`, kind, title: '', href: '', source: '', reason: '', score });
  const mixed = mixByKind([row('repo', 0.9), row('repo', 0.8), row('repo', 0.7), row('read', 0.4), row('problem', 0.25)], 4);
  assert.deepEqual(mixed.map((item) => item.key), ['repo0.9', 'read0.4', 'problem0.25', 'repo0.8']);
});

import type { SupabaseClient } from '@supabase/supabase-js';
import { reviewOpportunities, tidyOpportunities } from '../lib/opportunities/review';
test('a reviewed list hides rejected problems, drops filed-wrong quotes, and counts one sentence once', () => {
  const quote = (n: number, platform: Evidence['platform'], text = `a distinct complaint number ${n}`): Evidence => ({ ...evidence(n), platform, quote: text });
  const make = (slug: string, items: Evidence[]): Opportunity => ({ name: 'x', problem: '', gap: '', keywords: [], status: 'open', qualified: true, supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0, slug, evidence: items, platforms: [...new Set(items.map((item) => item.platform))] });
  const [guardrails, repeated] = tidyOpportunities([
    make('milvus-missing-now-function', [quote(1, 'github'), quote(2, 'stackoverflow'), quote(3, 'hn')]),
    make('repeated', [quote(1, 'hn', 'Same words here twice'), quote(2, 'github', 'same words here twice'), quote(3, 'hn')]),
    make('ai-agent-guardrails', [quote(1, 'github', 'WHEN ASKED TO REBOOT A SERVER IT WENT BACK ON THE SERVER'), quote(2, 'hn'), quote(3, 'github'), quote(4, 'hn')]),
    make('single', [quote(1, 'hn'), quote(2, 'hn', 'A distinct complaint number 1')]),
  ]);
  assert.equal(guardrails.slug, 'ai-agent-guardrails');
  assert.equal(guardrails.evidence.length, 3);
  assert.equal(guardrails.qualified, true);
  assert.equal(repeated.evidence.length, 2);
  assert.equal(repeated.qualified, false);
  assert.deepEqual(repeated.platforms, ['hn']);
});

test('reviewOpportunities applies DB review rows when present and falls back to constants when DB read fails', async () => {
  const quote = (n: number, platform: Evidence['platform'], text = `a distinct complaint number ${n}`): Evidence => ({ ...evidence(n), platform, quote: text });
  const make = (slug: string, items: Evidence[]): Opportunity => ({ name: 'x', problem: '', gap: '', keywords: [], status: 'open', qualified: true, supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0, slug, evidence: items, platforms: [...new Set(items.map((item) => item.platform))] });

  const dbRows = [
    { slug: 'custom-hidden-slug', kind: 'hide', quote: '', reason: 'vendor request' },
    { slug: 'custom-problem', kind: 'drop_quote', quote: 'Off-topic quote to drop', reason: 'wrong problem' },
  ];
  const okService = {
    from: () => ({
      select: () => ({
        order: async () => ({ data: dbRows, error: null }),
      }),
    }),
  } as unknown as SupabaseClient;

  const reviewedFromDb = await reviewOpportunities([
    make('custom-hidden-slug', [quote(1, 'github'), quote(2, 'hn'), quote(3, 'stackoverflow')]),
    make('custom-problem', [quote(1, 'github', 'Off-topic quote to drop'), quote(2, 'hn'), quote(3, 'github'), quote(4, 'stackoverflow')]),
  ], okService);
  assert.equal(reviewedFromDb.length, 1);
  assert.equal(reviewedFromDb[0].slug, 'custom-problem');
  assert.equal(reviewedFromDb[0].evidence.length, 3);
  assert.ok(!reviewedFromDb[0].evidence.some((item) => item.quote === 'Off-topic quote to drop'));

  const failingService = {
    from: () => ({
      select: () => ({
        order: async () => ({ data: null, error: { message: 'db unavailable' } }),
      }),
    }),
  } as unknown as SupabaseClient;

  const fallbackReviewed = await reviewOpportunities([
    make('milvus-missing-now-function', [quote(1, 'github'), quote(2, 'hn'), quote(3, 'stackoverflow')]),
    make('ai-agent-guardrails', [quote(1, 'github', 'WHEN ASKED TO REBOOT A SERVER IT WENT BACK ON THE SERVER'), quote(2, 'hn'), quote(3, 'github'), quote(4, 'hn')]),
  ], failingService);
  assert.equal(fallbackReviewed.length, 1);
  assert.equal(fallbackReviewed[0].slug, 'ai-agent-guardrails');
  assert.equal(fallbackReviewed[0].evidence.length, 3);
});

import { READ_MEMORY_DAYS, rememberRun } from '../lib/opportunities/rules';
import type { RawSignal } from '../lib/opportunities/types';

test('read memory keeps recent posts and pains, forgets old ones, and drops pains that became evidence', () => {
  const post = (url: string): RawSignal => ({ id: url, actor: 'hn-ask', platform: 'hn', title: 't', text: 'x'.repeat(2000), url, score: 0, postedAt: null });
  const now = '2026-11-18T00:00:00.000Z';
  const old = new Date(new Date(now).getTime() - (READ_MEMORY_DAYS + 1) * 86_400_000).toISOString();
  const memory = {
    read: { 'https://old': old, 'https://kept': now },
    pains: [
      { quote: 'a pain read too long ago', item: post('https://old'), readAt: old },
      { quote: 'a pain that is now evidence', item: post('https://used'), readAt: now },
      { quote: 'a pain still waiting', item: post('https://kept'), readAt: now },
    ],
  };
  const next = rememberRun(memory, ['https://new'], [{ quote: 'A pain still waiting', item: post('https://dup') }, { quote: 'a new pain', item: post('https://new') }], now, new Set(['https://used']));
  assert.deepEqual(Object.keys(next.read).sort(), ['https://kept', 'https://new']);
  assert.deepEqual(next.pains.map((pain) => pain.quote), ['a pain still waiting', 'a new pain']);
  assert.equal(next.pains[1].item.text.length, 800);
  assert.deepEqual(rememberRun(null, [], [], now, new Set()), { read: {}, pains: [] });
});

test('a maker announcing a product is not read as someone lacking a tool', async () => {
  const { isPromotion } = await import('../lib/opportunities/rules');
  for (const title of ['Show HN: A faster lockfile differ', 'I built a CLI that finds broken packages', 'Introducing Foo, the GIF API', 'Launch HN: Acme (YC W26)'])
    assert.equal(isPromotion({ title, text: '' }), true, title);
  assert.equal(isPromotion({ title: '', text: 'We just launched our tool for on-call notes, check it out' }), true);
  assert.equal(isPromotion({ title: 'Is there a tool to diff lockfiles?', text: 'Every week CI breaks and I wish there was a way. In the end I built a script.' }), false);
  assert.equal(isPromotion({ title: 'Why is there no good way to test MCP servers', text: 'I tried everything.' }), false);
});

test('citation precision counts only published quotes and lists the unlabeled ones', async () => {
  const { precisionOf } = await import('../lib/opportunities/eval');
  const opportunities = [{ slug: 'a', evidence: [{ id: 'e1', quote: 'q1' }, { id: 'e2', quote: 'q2' }, { id: 'e3', quote: 'q3' }] }];
  const result = precisionOf(opportunities, {
    e1: { slug: 'a', quote: 'q1', relevant: true, by: 'jihun' },
    e2: { slug: 'a', quote: 'q2', relevant: false, by: 'claude-draft' },
    gone: { slug: 'b', quote: 'old', relevant: false, by: 'jihun' },
  });
  assert.equal(result.labeled, 2);
  assert.equal(result.precision, 50);
  assert.equal(result.byPeople, 1);
  assert.deepEqual(result.unlabeled.map((row) => row.id), ['e3']);
  assert.equal(precisionOf([], {}).precision, null);
});

test('a quote cut off on a colon or comma is not evidence', async () => {
  const { isCompleteQuote } = await import('../lib/opportunities/rules');
  assert.equal(isCompleteQuote('Amazon Bedrock does not provide an API that returns:'), false);
  assert.equal(isCompleteQuote('every time I switch providers, '), false);
  assert.equal(isCompleteQuote('I had to rewrite large parts of my code.'), true);
  assert.equal(isCompleteQuote('Is there a tool to diff lockfiles?'), true);
});

test('free thinking models always get room to answer, paid models get what was asked', async () => {
  const { outputTokenCap } = await import('../lib/llm');
  assert.equal(outputTokenCap('baidu/ernie-5.5-flash-preview:free', 2_400), 16_000);
  assert.equal(outputTokenCap('baidu/ernie-5.5-flash-preview:free', 20_000), 20_000);
  assert.equal(outputTokenCap('anthropic/claude-sonnet-5', 2_400), 2_400);
  assert.equal(outputTokenCap('lg/exaone', 2_400, true), 16_000);
});
