import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBars,
  buildTrendCandidates,
  buildWhyTrending,
  extractBuildIdeas,
  getWeeklyGrowthRate,
  isAllowedEntityTitle,
  isGenericTitle,
  isTrendCandidateStrongEnough,
  normalizePackageLikeName,
  staleTrendKeywords,
  type KeywordSignalInput,
} from '../lib/ingest/trend-builder';

test('buildBars never fabricates a trend curve from a single score and keeps real multi-day snapshots', () => {
  assert.deepEqual(buildBars(), []);
  assert.deepEqual(buildBars([90]), []);
  assert.deepEqual(buildBars([45, 62, 78]), [45, 62, 78]);
  assert.deepEqual(buildBars([10, 20, 30, 40, 50, 60, 70, 80]), [20, 30, 40, 50, 60, 70, 80]);
});

test('getWeeklyGrowthRate returns 0 without a prior-week baseline and buildWhyTrending avoids fake 100% claims', () => {
  assert.equal(getWeeklyGrowthRate(5, 0), 0);
  assert.equal(getWeeklyGrowthRate(6, 3), 100);

  const now = new Date().toISOString();
  const recentSignals: KeywordSignalInput[] = [
    {
      keyword: 'MCP Server Design',
      normalized_keyword: 'mcp server design',
      source_type: 'github',
      source_id: 'repo-1',
      source_title: 'mcp-toolkit',
      source_url: 'https://github.com/example/mcp-toolkit',
      weight: 25,
      metadata: { category: '구현 패턴', entity_type: 'architecture', display_name: 'MCP Server Design' },
      detected_at: now,
    },
    {
      keyword: 'MCP Server Design',
      normalized_keyword: 'mcp server design',
      source_type: 'hackernews',
      source_id: 'hn-1',
      source_title: 'Building an MCP server',
      source_url: 'https://news.ycombinator.com/item?id=1',
      weight: 22,
      metadata: { category: '구현 패턴', entity_type: 'architecture', display_name: 'MCP Server Design' },
      detected_at: now,
    },
  ];
  const candidate = [...buildTrendCandidates(recentSignals).values()][0];
  assert.ok(candidate);
  const newReasons = buildWhyTrending(candidate, 100, true);
  assert.ok(!newReasons.some((line) => line.includes('상승했습니다')), `unexpected growth claim: ${newReasons.join(' | ')}`);
  assert.ok(newReasons.some((line) => line.includes('새로 등장')));

  // With a real previous-week baseline, a genuine growth rate is shown.
  candidate.previousSourceKeys.add('rss:prev-1');
  const risingReasons = buildWhyTrending(candidate, 100, false);
  assert.ok(risingReasons.some((line) => line.includes('100% 상승했습니다')));
});

test('extractBuildIdeas keeps MCP 서버 만들기 and Figma to Code 워크플로우 instead of self-filtering them', () => {
  const mcpIdeas = extractBuildIdeas('How to build a Model Context Protocol (MCP) server');
  assert.ok(mcpIdeas.includes('MCP 서버 만들기'), `expected MCP 서버 만들기 in ${JSON.stringify(mcpIdeas)}`);
  assert.equal(isAllowedEntityTitle('MCP 서버 만들기', '빌드 아이디어'), true);

  const figmaIdeas = extractBuildIdeas('Automating Figma design to code handoff');
  assert.ok(figmaIdeas.includes('Figma to Code 워크플로우'), `expected Figma to Code 워크플로우 in ${JSON.stringify(figmaIdeas)}`);
  assert.equal(isAllowedEntityTitle('Figma to Code 워크플로우', '빌드 아이디어'), true);
});

test('build idea candidates with 2 strong signals pass threshold', () => {
  const now = new Date().toISOString();
  const signals: KeywordSignalInput[] = [
    {
      keyword: 'MCP 서버 만들기',
      normalized_keyword: 'mcp 서버 만들기',
      source_type: 'rss',
      source_id: 'news-1',
      source_title: 'Build your first MCP server',
      source_url: 'https://example.com/1',
      weight: 20,
      metadata: { category: '빌드 아이디어', entity_type: 'build_idea', display_name: 'MCP 서버 만들기', project_idea: 'MCP 서버 만들기' },
      detected_at: now,
    },
    {
      keyword: 'MCP 서버 만들기',
      normalized_keyword: 'mcp 서버 만들기',
      source_type: 'rss',
      source_id: 'news-2',
      source_title: 'Production MCP server checklist',
      source_url: 'https://example.com/2',
      weight: 20,
      metadata: { category: '빌드 아이디어', entity_type: 'build_idea', display_name: 'MCP 서버 만들기', project_idea: 'MCP 서버 만들기' },
      detected_at: now,
    },
  ];
  const candidate = [...buildTrendCandidates(signals).values()][0];
  assert.ok(candidate);
  assert.equal(isTrendCandidateStrongEnough(candidate), true);
});

test('normalizePackageLikeName keeps scoped npm packages and blocks generic package noise', () => {
  assert.equal(normalizePackageLikeName('@ai-sdk/core'), '@ai-sdk/core');
  assert.equal(normalizePackageLikeName('@modelcontextprotocol/sdk'), '@modelcontextprotocol/sdk');
  assert.equal(normalizePackageLikeName('cli'), '');
  assert.equal(normalizePackageLikeName('core'), '');
  assert.equal(normalizePackageLikeName('sdk'), '');
  assert.equal(normalizePackageLikeName('mcp-server'), '');
  assert.equal(normalizePackageLikeName('observability'), '');
  assert.equal(isGenericTitle('cli'), true);
  assert.equal(isGenericTitle('core'), true);
  assert.equal(isGenericTitle('mcp-server'), true);
  assert.equal(isGenericTitle('@ai-sdk/core'), false);
});

test('staleTrendKeywords returns prior-run keywords missing from the latest ranking', () => {
  assert.deepEqual(
    staleTrendKeywords(['Claude Code', 'cli', 'old-topic', 'Cursor'], ['Claude Code', 'Cursor']),
    ['cli', 'old-topic'],
  );
});
