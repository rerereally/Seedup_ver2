import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { featureIssue, githubIssueCommands, githubRepo, issuesCsv, issueUrl } from '../lib/opportunities/issues';
import type { FeatureIssue } from '../lib/opportunities/issues';
import { parsePrdMarkdown } from '../lib/opportunities/prd-markdown';
import { savedPrdPreview, slackPrdSummary } from '../lib/opportunities/prd-share';
import { normalizeSlots, normalizeSpec, renderAgentBrief, renderSpecMarkdown, SLOT_KEYS } from '../lib/opportunities/spec';
import type { SpecInput } from '../lib/opportunities/spec';

const share = 'https://seedup.example/spec/11111111-1111-1111-1111-111111111111';
const quote = { id: 'one', platform: 'hn' as const, quote: 'original quote', quoteKo: '', url: 'https://example.org/quote?a=1&b=2#text', score: 0, postedAt: null };
const input: SpecInput = { title: '서비스', problem: 'problem', gap: '', competitors: [], evidence: [quote, { ...quote, id: 'two', url: 'https://' }] };
const spec = normalizeSpec({
  summary: '검색 결과를 보여줍니다.',
  requirements: [
    { title: '검색 결과', priority: 'P0', acceptance: ['결과 목록을 반환한다'], evidence: [1, 2] },
    { title: '결과 저장', priority: 'P1', evidence: [1] },
    { title: '자동 완성', priority: 'P2', evidence: [] },
  ],
  features: [
    { title: '저장하기', requirements: [2], detail: '결과를 저장합니다.' },
    { title: '한글 & 검색 #1', requirements: [1, 2], detail: '검색합니다.' },
    { title: '자동 완성', requirements: [3], detail: '자동 완성합니다.' },
  ],
}, 2, true, { idea: true });

test('issue exports trace requirements, hypotheses, priorities, acceptance and source URLs', () => {
  const issue = featureIssue(input, spec, spec.features[1], 'ko', share);
  assert.equal(issue.title, 'F-02 한글 & 검색 #1');
  assert.equal(issue.priority, 'P0');
  assert.match(issue.body, /R-01 \[P0\].*\n- R-02 \[P1\]/);
  assert.match(issue.body, /- \[ \] 결과 목록을 반환한다 \(R-01\)/);
  assert.match(issue.body, /E-1 <https:\/\/example\.org\/quote\?a=1&b=2#text>/);
  assert.doesNotMatch(issue.body, /E-2/);
  assert.equal(issue.body.split('https://example.org/').length, 2);
  assert.ok(issue.body.endsWith(`[전체는 Seedup에서](${share})`));

  const hypothesis = featureIssue(input, spec, spec.features[2], 'en');
  assert.match(hypothesis.body, /H-01 \[P2\]/);
  assert.doesNotMatch(hypothesis.body, /Source quotes|Full PRD on Seedup/);
});

test('issue URLs round-trip punctuation and limit the complete encoded URL to 6000 characters', () => {
  const issue = featureIssue(input, spec, spec.features[1], 'ko', share);
  const github = new URL(issueUrl(issue, 'github', 'ko', 'owner/repo')!);
  const labeled = new URL(issueUrl(issue, 'github', 'ko', 'owner/repo', true)!);
  const linear = new URL(issueUrl(issue, 'linear', 'ko')!);
  assert.equal(github.pathname, '/owner/repo/issues/new');
  assert.equal(github.searchParams.get('title'), issue.title);
  assert.equal(github.searchParams.get('body'), issue.body);
  assert.equal(github.searchParams.has('labels'), false);
  assert.equal(labeled.searchParams.get('labels'), 'P0');
  assert.equal(linear.origin, 'https://linear.new');
  assert.equal(linear.searchParams.get('title'), issue.title);
  assert.equal(linear.searchParams.get('description'), issue.body);
  assert.equal(linear.searchParams.get('priority'), 'urgent');

  const long = { ...issue, body: issue.body + '한글🙂& #\n'.repeat(1400) };
  for (const target of ['github', 'linear'] as const) {
    const shortened = issueUrl(long, target, 'ko', 'owner/repo')!;
    assert.ok(shortened.length <= 6000);
    const body = new URL(shortened).searchParams.get(target === 'github' ? 'body' : 'description')!;
    assert.ok(body.endsWith(`…\n\n[전체는 Seedup에서](${share})`));
    assert.doesNotMatch(body, /\uFFFD/);
  }
  const unshared = new URL(issueUrl({ ...long, shareUrl: undefined }, 'linear', 'en')!);
  assert.ok(unshared.searchParams.get('description')?.endsWith('See the full PRD in Seedup.'));
});

test('GitHub repository validation allows repository names and rejects unsafe paths', () => {
  assert.equal(githubRepo(' My-Org/repo.name_1 '), 'My-Org/repo.name_1');
  for (const invalid of ['https://github.com/a/b', 'a/b/c', '-a/b', 'a--b/x', 'a/..', 'a/b?title=x', 'a/b#c', 'a/b%2fc', 'a/b\nc', 'a;echo hi/b']) {
    assert.equal(githubRepo(invalid), null, invalid);
  }
});

test('copied gh commands send literal data to a stub and put P0 first', () => {
  const expansion = '$' + '(printf EXPANDED)';
  const urgent: FeatureIssue = {
    title: `F-02 team's ${expansion}`,
    body: ['SEEDUP_ISSUE', 'SEEDUP_ISSUE_', expansion, "it's still body text"].join('\n'),
    priority: 'P0',
  };
  const later: FeatureIssue = { title: 'F-01 Later', body: 'after P0', priority: 'P1' };
  const commands = githubIssueCommands('my-org/my-repo', [later, urgent]);
  assert.ok(commands);
  const output = execFileSync('/bin/sh', ['-c', `gh() { printf '%s\n' "$@"; cat; };\n${commands}`], { encoding: 'utf8' });
  const args = (issue: FeatureIssue) => ['issue', 'create', '--repo', 'my-org/my-repo', '--title', issue.title, '--body-file', '-', issue.body, ''].join('\n');
  assert.equal(output, args(urgent) + args(later));
});

test('CSV uses each importer’s title header and quotes multiline, formula-like cells', () => {
  const issue: FeatureIssue = { title: '=A1', body: '  +1,"hi"\nnext line', priority: 'P0' };
  assert.equal(issuesCsv([issue], 'jira'), 'Summary,Description,Priority,Labels\r\n"\'=A1","\'  +1,""hi""\nnext line","P0","P0"');
  assert.equal(issuesCsv([issue], 'linear'), 'Title,Description,Priority,Labels\r\n"\'=A1","\'  +1,""hi""\nnext line","Urgent","P0"');
  for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
    assert.ok(issuesCsv([{ title: prefix + 'value', body: 'safe' }], 'jira').includes(`"'${prefix}value"`));
  }
});

test('Markdown task lists round-trip and saved PRD previews use the linked P0 features', () => {
  for (const lang of ['ko', 'en'] as const) {
    const markdown = renderSpecMarkdown(input, { ...spec, lang });
    assert.match(markdown, /- \[ \] (수락 기준|Acceptance): 결과 목록을 반환한다/);
    const parsed = parsePrdMarkdown(markdown);
    const requirements = parsed?.requirements as Array<{ acceptance: string[] }>;
    assert.deepEqual(requirements[0].acceptance, ['결과 목록을 반환한다']);
    assert.deepEqual(savedPrdPreview(markdown.replace(/\n/g, '\r\n')), {
      summary: spec.summary, p0Features: ['F-02 한글 & 검색 #1'],
    });
    const preview = savedPrdPreview(markdown);
    assert.equal(slackPrdSummary(input.title, preview.summary, preview.p0Features, share, lang), `서비스\n\n${spec.summary}\n\nP0\n- F-02 한글 & 검색 #1\n\n${share}`);
  }
  assert.deepEqual(savedPrdPreview('## Summary\n\n## Problem\nOld export'), { summary: '', p0Features: [] });
  assert.match(slackPrdSummary('Private', '', [], undefined, 'en'), /Enable the share link in Seedup Bookmarks/);
});

test('coding and app builder exports name the same features and condition issue creation on MCP', () => {
  for (const format of ['agents', 'claude', 'cursor', 'prompt'] as const) {
    const brief = renderAgentBrief(input, spec, format);
    assert.match(brief, /F-02 한글 & 검색 #1\n +(?:- )?\(P0\)/);
    assert.match(brief, /If Linear or GitHub MCP is connected, create issues.*exact F-n title.*start with P0.*Seedup MCP/);
    assert.match(brief, /Skip issue creation if neither Linear nor GitHub MCP is connected\.\s*$/);
  }
});

test('AGENTS.md tells agents to resume the Seedup project before picking work and leave a handoff', () => {
  const projectKey = 'prd:11111111-1111-1111-1111-111111111111';
  const brief = renderAgentBrief(input, spec, 'agents', projectKey);
  const resume = 'resume_project {"project":"prd:11111111-1111-1111-1111-111111111111"}';
  assert.ok(brief.indexOf('## Rules') < brief.indexOf('## Goal'));
  assert.ok(brief.includes(resume));
  assert.ok(brief.indexOf(resume) < brief.indexOf('get_next_task'));
  assert.match(brief, /before stopping.*save_handoff/i);
  assert.match(brief, /## User evidence/);
  assert.ok(Buffer.byteLength(brief, 'utf8') <= 24_000);
  assert.doesNotMatch(renderAgentBrief(input, spec, 'cursor', projectKey), /resume_project|save_handoff/);
});

test('oversized AGENTS.md fits the 24,000 UTF-8 byte rule limit and keeps the session instructions', () => {
  const slots = normalizeSlots(Object.fromEntries(SLOT_KEYS.map((key) => [key, Array(5).fill('요구 조건과 예외를 설명합니다.🙂'.repeat(30))])));
  const largeSpec = { ...spec, features: Array.from({ length: 10 }, (_, index) => ({
    ...spec.features[0], id: 'F-' + String(index + 1).padStart(2, '0'), slots,
  })) };
  const brief = renderAgentBrief(input, largeSpec, 'agents', 'example');
  assert.ok(Buffer.byteLength(renderAgentBrief(input, largeSpec, 'claude', 'example'), 'utf8') > 24_000);
  assert.ok(Buffer.byteLength(brief, 'utf8') <= 24_000);
  assert.match(brief, /resume_project \{"project":"example"\}/);
  assert.match(brief, /Read the full PRD in Seedup\.\s*$/);
  assert.doesNotMatch(brief, /\uFFFD/);
});
