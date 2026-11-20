import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/ideas/questions/route';
import { briefFacts } from '../lib/db/project-brief';
import { readBrief } from '../lib/opportunities/idea';
import {
  canAskQuestionRound, CLOSING_QUESTION_TEXT, MAX_QUESTION_ROUNDS, MAX_TOTAL_QUESTIONS,
  normalizeQuestions, readQuestionHistory, restoreQuestionProgress,
} from '../lib/opportunities/questions';

const question = (key: string, text: string) => ({ key, question: text, options: ['One', 'Two'] });
const first = question('input', 'Where do the files come from?');
const second = question('output', 'Where should the report go?');

test('all twelve answers reach the PRD and project memory, including the last one', () => {
  const idea = 'A report generator';
  const answers = Array.from({ length: MAX_TOTAL_QUESTIONS }, (_, index) => ({
    key: `question_${index + 1}`, question: `Planning question ${index + 1}?`, answer: `Answer ${index + 1}`,
  }));
  const competitors = { key: 'validation_competitors', question: 'Direct competitors?', answer: 'Example' };
  const brief = readBrief({ idea, answers: [...answers, competitors] });
  assert.deepEqual(brief?.answers, [...answers, competitors]);
  const facts = briefFacts({ answers }, []);
  assert.equal(facts.length, MAX_TOTAL_QUESTIONS + 1);
  assert.equal(facts.at(-1), 'Planning answer. Planning question 12?: Answer 12');
});

test('classification and completion are normalized with an explicit track taking priority', () => {
  const raw = { track: 'B', trackReason: ' For  outside users.\n', done: 'true', questions: [first, second] };
  const inferred = normalizeQuestions(raw, {});
  assert.equal(inferred.track, 'B');
  assert.equal(inferred.trackReason, 'For outside users.');
  assert.equal(inferred.done, false);
  assert.equal(inferred.questions?.length, 2);
  assert.equal(normalizeQuestions(raw, { track: 'A' }).track, 'A');
  assert.equal(normalizeQuestions(raw, { track: 'A' }).trackReason, '');
  assert.equal(normalizeQuestions({ ...raw, track: 'invalid' }, {}).track, 'A');
  assert.deepEqual(normalizeQuestions(null, { track: 'A' }), { questions: null, track: 'A', trackReason: '', done: true });
});

test('skipped and uncertain answers count as seen, and repeated keys and normalized text are dropped', () => {
  const history = readQuestionHistory([
    { ...first, answer: '' },
    { ...second, answer: 'Not sure. Decide what fits.' },
    { ...second, answer: null },
  ]);
  assert.deepEqual(history.map(({ answer }) => answer), ['', 'Not sure. Decide what fits.']);
  const result = normalizeQuestions({ questions: [
    question('input', 'How do the files arrive?'),
    question('other_output', '**WHERE** should the report go?'),
    question('another_extra', CLOSING_QUESTION_TEXT.en),
    question('schedule', 'When should it run?'),
    question('schedule', 'How often should it repeat?'),
    question('frequency', 'When  should it run?'),
    question('errors', 'How should it report errors?'),
  ] }, { history });
  assert.deepEqual(result.questions?.map(({ key }) => key), ['schedule', 'errors']);
  assert.equal(result.done, false);
});

test('the interview stops on done, no fresh questions, the round limit, or the question limit', () => {
  const history = [{ ...first, answer: 'A shared folder' }];
  const complete = normalizeQuestions({ done: true, questions: [second] }, { history });
  assert.equal(complete.done, true);
  assert.deepEqual(complete.questions, []);
  for (const raw of [null, { questions: [] }, { done: false, questions: [first] }]) {
    const empty = normalizeQuestions(raw, { history });
    assert.equal(empty.done, true);
    assert.deepEqual(empty.questions, []);
  }
  assert.equal(canAskQuestionRound(MAX_QUESTION_ROUNDS - 1, MAX_TOTAL_QUESTIONS - 1), true);
  assert.equal(canAskQuestionRound(MAX_QUESTION_ROUNDS, MAX_TOTAL_QUESTIONS - 1), false);
  assert.equal(canAskQuestionRound(MAX_QUESTION_ROUNDS - 1, MAX_TOTAL_QUESTIONS), false);
  const almostFull = Array.from({ length: MAX_TOTAL_QUESTIONS - 1 }, (_, index) => ({
    key: `previous_${index}`, question: `Question ${index}?`, answer: '',
  }));
  assert.deepEqual(normalizeQuestions({ questions: [first, second] }, { history: almostFull }).questions?.map(({ key }) => key), ['input']);
});

test('old fixed and tailored saves reopen with their original answers, and new saves keep their rounds', () => {
  const idea = 'A report generator';
  const fixed = { idea, answers: { users: 'Our team', pain: '' } };
  assert.deepEqual(restoreQuestionProgress(fixed), { rounds: [], fallback: true });
  const questions = [first, second].map(({ key, question, options }) => ({ key, text: question, chips: options }));
  const tailored = { idea, answers: { input: 'Drive', extra: '' }, plan: { idea, questions } };
  assert.deepEqual(restoreQuestionProgress(tailored), { rounds: [questions], done: false });
  assert.equal(restoreQuestionProgress({ ...tailored, answers: { ...tailored.answers, output: '' } }).done, true);
  assert.deepEqual(restoreQuestionProgress({ ...fixed, plan: tailored.plan }), { rounds: [], fallback: true });
  const progress = { track: 'B' as const, rounds: [questions.slice(0, 1), questions.slice(1)], defaults: true };
  assert.deepEqual(restoreQuestionProgress({ ...tailored, progress }), progress);
});

test('questions API keeps the fixture first batch and ends a follow-up that only repeats it', async (t) => {
  const previous = process.env.LLM_FIXTURES;
  process.env.LLM_FIXTURES = '1';
  t.after(() => {
    if (previous === undefined) delete process.env.LLM_FIXTURES;
    else process.env.LLM_FIXTURES = previous;
  });
  const request = (input: object) => new Request('http://localhost/api/ideas/questions', {
    method: 'POST',
    body: JSON.stringify({ idea: '온콜 인수인계 자동화', quotes: [], lang: 'ko', ...input }),
  });
  const initial = await POST(request({}));
  assert.equal(initial.status, 200);
  const { questions, track, done } = await initial.json();
  assert.equal(questions[0].key, 'first_team');
  assert.equal(track, 'A');
  assert.equal(done, false);
  const history = questions.map(({ key, question }: { key: string; question: string }) => ({ key, question, answer: '' }));
  const next = await POST(request({ track: 'B', history }));
  assert.deepEqual(await next.json(), { questions: [], track: 'B', trackReason: '', done: true });
});
