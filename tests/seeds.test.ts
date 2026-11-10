import assert from 'node:assert/strict';
import test from 'node:test';
import { matchLinks, nearOpportunities, parseArxivFeed, parseIdeas, repoTerms } from '../lib/seeds/advise';
import { isGitHubLogin } from '../lib/seeds/github';
import type { SeedRepo } from '../lib/seeds/github';
import type { Opportunity } from '../lib/opportunities/types';

const repo: SeedRepo = { name: 'rag-eval-kit', fullName: 'me/rag-eval-kit', url: 'https://github.com/me/rag-eval-kit', description: 'Evaluate retrieval pipelines', language: 'Python', topics: ['rag', 'llm-evaluation'], stars: 3, pushedAt: null, readme: 'Switching models means rewriting code for every provider schema.' };

const opportunity = (slug: string, keywords: string[]): Opportunity => ({ slug, name: slug, problem: 'p', gap: 'g', keywords, status: 'open', qualified: true, platforms: ['hn'], evidence: [{ id: 'e1', platform: 'hn', quote: 'q', quoteKo: '인용', url: 'https://example.com', score: 1, postedAt: null }], supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0 });

test('GitHub logins are validated before they reach a URL', () => {
  assert.equal(isGitHubLogin('torvalds'), true);
  assert.equal(isGitHubLogin('a-b'), true);
  assert.equal(isGitHubLogin('../etc'), false);
  assert.equal(isGitHubLogin('a--b'), false);
  assert.equal(isGitHubLogin(''), false);
});

test('generic words never identify a repo', () => {
  const terms = repoTerms({ ...repo, name: 'my-web-app', topics: [], language: '' });
  assert.equal(terms.size, 0);
});

test('links need more than one weak term', () => {
  const items = [
    { title: 'RAG 평가 방법', href: '/news/1', meta: '', external: false, text: 'RAG 평가 방법 rag' },
    { title: 'Python 3.14 출시', href: '/news/2', meta: '', external: false, text: 'Python 3.14 출시' },
  ];
  assert.deepEqual(matchLinks(repo, items).map((item) => item.href), ['/news/1']);
});

test('near opportunities need two keyword hits or a strong similarity', () => {
  const items = [opportunity('schema', ['provider', 'schema', 'models']), opportunity('other', ['gif', 'tenor'])];
  assert.deepEqual(nearOpportunities(repo, items).map((item) => item.slug), ['schema']);
  assert.deepEqual(nearOpportunities(repo, items, { other: 0.5 }).map((item) => item.slug), ['other', 'schema']);
});

test('model output keeps only known repos and known opportunities', () => {
  const ideas = parseIdeas({ repos: [
    { name: 'rag-eval-kit', summary: '요약', paperQuery: 'RAG evaluation; DROP', features: [{ title: '기능', why: '이유', opportunity: 'made-up' }, { title: '', why: '빈 제목' }, { title: '둘', why: '이유', opportunity: 'schema' }] },
    { name: 'not-mine', summary: 'x', features: [] },
  ] }, [repo], [opportunity('schema', [])]);
  assert.deepEqual(Object.keys(ideas), ['rag-eval-kit']);
  assert.equal(ideas['rag-eval-kit'].features.length, 2);
  assert.equal(ideas['rag-eval-kit'].features[0].opportunity, null);
  assert.equal(ideas['rag-eval-kit'].features[1].opportunity?.slug, 'schema');
  assert.equal(ideas['rag-eval-kit'].paperQuery, 'RAG evaluation DROP');
});

test('arXiv feed entries are parsed and non-arXiv links dropped', () => {
  const xml = '<feed><entry><id>http://arxiv.org/abs/1234.5678v1</id><published>2025-03-01T00:00:00Z</published><title>A &amp; B\n study</title><summary>Short.</summary></entry><entry><id>http://evil.example/x</id><title>Bad</title></entry></feed>';
  assert.deepEqual(parseArxivFeed(xml), [{ title: 'A & B study', url: 'https://arxiv.org/abs/1234.5678v1', year: '2025', summary: 'Short.' }]);
});
