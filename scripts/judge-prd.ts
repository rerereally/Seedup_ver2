// Scores the content of PRDs saved by scripts/eval-prd.ts, so a prompt or model change is judged on how good the
// document is, not only on its shape. One strong model reads each PRD with its source quotes and scores five
// criteria. Run it on the old and new eval files together; the same judge and rubric make the numbers comparable.
//   npx tsx --env-file=.env scripts/judge-prd.ts eval-old.json eval-new.json [--judge anthropic/claude-sonnet-5.5]
// Costs about US$0.01 per PRD with the default judge.
import { readFileSync } from 'node:fs';
import { OPENROUTER_BASE } from '../lib/llm';

const RUBRIC = `You review product requirement documents (PRDs) for developer tools. The PRD below is in Korean or English and ends with the source quotes it was built on (E-1, E-2, ...). Score it strictly; a 3 is an ordinary draft, a 5 is what a senior PM would sign off without edits.

specific (1-5): requirements and features state inputs, outputs, numbers and conditions an engineer can build from; no vague words like "easily" or "efficiently".
grounded (1-5): every claim tied to a quote really follows from that quote; nothing invented (no made-up statistics, companies or user counts); lines without support are marked as hypotheses or open questions.
readable (1-5): natural, concise prose in the document's language (no translationese), a clear structure, the why is explained, not just a list of fields.
actionable (1-5): a small team could start building v1 tomorrow: scope is narrow and consistent, priorities are clear, acceptance criteria are testable, every requirement is covered by a feature.
complete (1-5): users, a concrete usage scenario, goals, non-goals, risks, success metrics and open questions are present and meaningful, not filler.
overall (1-10): how useful this PRD is to a developer about to build the product.

Return only JSON: {"specific":n,"grounded":n,"readable":n,"actionable":n,"complete":n,"overall":n,"weakest":"the single biggest problem, one sentence"}`;

const CRITERIA = ['specific', 'grounded', 'readable', 'actionable', 'complete', 'overall'] as const;
type Score = Record<(typeof CRITERIA)[number], number> & { weakest: string };

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function judge(doc: string, model: string): Promise<Score | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'x-title': 'Seedup PRD judge' },
      body: JSON.stringify({ model, temperature: 0, max_tokens: model.endsWith(":free") ? 16_000 : 400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: RUBRIC }, { role: 'user', content: `<prd>\n${doc.slice(0, 24_000)}\n</prd>` }] }),
    }).catch(() => null);
    if (!response?.ok) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '';
    try {
      const parsed = JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)) as Score;
      if (CRITERIA.every((key) => typeof parsed[key] === 'number')) return parsed;
    } catch {
      // Malformed answer: try again.
    }
  }
  return null;
}

const mean = (values: number[]) => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : 0);

async function main() {
  const files = process.argv.slice(2).filter((value, index, all) => !value.startsWith('--') && all[index - 1] !== '--judge');
  const model = arg('--judge', 'anthropic/claude-sonnet-5.5');
  if (!files.length || !process.env.OPENROUTER_API_KEY) throw new Error('usage: judge-prd.ts <eval.json>... (needs OPENROUTER_API_KEY)');
  const results: Array<{ file: string; scores: Array<{ id: string; score: Score | null }> }> = [];
  for (const file of files) {
    const run = JSON.parse(readFileSync(file, 'utf8')) as { docs?: Record<string, string | null> };
    const docs = Object.entries(run.docs ?? {});
    const scores: Array<{ id: string; score: Score | null }> = [];
    // Four at a time: fast enough, and well inside the provider's rate limit.
    for (let index = 0; index < docs.length; index += 4) {
      scores.push(...(await Promise.all(docs.slice(index, index + 4).map(async ([id, doc]) => ({ id, score: doc ? await judge(doc, model) : null })))));
    }
    results.push({ file, scores });
  }

  console.log(`### PRD content scores (judge: ${model})\n`);
  console.log(`| run | PRDs | ${CRITERIA.join(' | ')} |`);
  console.log(`|---|---|${CRITERIA.map(() => '---').join('|')}|`);
  for (const { file, scores } of results) {
    // A failed PRD counts as the lowest score, so a run cannot look better by failing its hard cases.
    const values = (key: (typeof CRITERIA)[number]) => scores.map((row) => row.score?.[key] ?? (key === 'overall' ? 1 : 1));
    console.log(`| ${file.split('/').pop()} | ${scores.filter((row) => row.score).length}/${scores.length} | ${CRITERIA.map((key) => mean(values(key))).join(' | ')} |`);
  }
  for (const { file, scores } of results) {
    console.log(`\n#### ${file.split('/').pop()}`);
    for (const row of scores) console.log(`- ${row.id}: ${row.score ? `${row.score.overall}/10 · ${row.score.weakest}` : 'no PRD or no score'}`);
  }
}

void main();
