import assert from 'node:assert/strict';
import test from 'node:test';
import { briefFacts } from '../lib/db/project-brief';
import type { Evidence, Platform } from '../lib/opportunities/types';

const quote = (id: string, platform: Platform): Evidence => ({ id, platform, quote: 'q', quoteKo: 'q', url: 'https://example.com', score: 1, postedAt: null });

test('the verdict comes from the saved quotes, and own notes do not count', () => {
  const [verdict] = briefFacts({}, [quote('a', 'github'), quote('b', 'github'), quote('c', 'own')]);
  assert.match(verdict, /^Evidence verdict: 2 verified quotes from 1 site\. Below the 3-quotes-from-2-sites bar/);
  assert.match(briefFacts({}, [quote('a', 'github'), quote('b', 'hn'), quote('c', 'github')])[0], /Meets the 3-quotes-from-2-sites bar\.$/);
});

test('competitors and answers are trimmed, and junk is dropped', () => {
  const facts = briefFacts({
    competitors: ['  Linear ', '', 42, 'Jira'],
    answers: [{ question: '누가 쓰나요?', answer: ' 1인 개발자 ' }, { question: 'empty' }, 'junk', null],
  }, []);
  assert.deepEqual(facts.slice(1), ['Direct competitors found in planning: Linear; Jira', 'Planning answer. 누가 쓰나요?: 1인 개발자']);
  assert.equal(briefFacts(null, []).length, 1);
});
