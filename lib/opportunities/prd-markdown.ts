// Reads the Markdown PRD the model streamed (format in prd-prompt.ts) back into the raw spec that normalizeSpec checks.
// Models drift from the format in small ways (bold item ids, bullets instead of ###, citations in the body), so each
// part has a tolerant reading; anything that cannot be read is left out rather than guessed.
import type { RawSpec } from './spec';

type Section = 'summary' | 'background' | 'users' | 'scenario' | 'goals' | 'nonGoals' | 'requirements' | 'features' | 'rivals' | 'risks' | 'assumptions' | 'metrics' | 'openQuestions';

// Order matters: the first match wins, so "non-goals" is tried before "goals" and "success metrics" before "users".
const SECTIONS: Array<[Section, RegExp]> = [
  ['summary', /한\s*줄\s*요약|요약|summary/i],
  ['background', /배경|background/i],
  ['scenario', /사용\s*장면|장면|scenario/i],
  ['nonGoals', /하지\s*않을|범위\s*밖|non-?goals|out of scope/i],
  ['goals', /목표|goals?/i],
  ['users', /대상|사용자|target|users?/i],
  ['requirements', /요구\s*사항|requirements?/i],
  ['rivals', /이미\s*있는\s*도구|경쟁|existing tools|competitors|rivals/i],
  ['features', /기능|features?/i],
  ['risks', /위험|risks?/i],
  ['assumptions', /가정|assumptions?/i],
  ['metrics', /지표|완료\s*기준|metrics|success/i],
  ['openQuestions', /열린\s*질문|open questions?/i],
];

const ACCEPTANCE = /^(?:수락\s*기준|완료\s*기준|acceptance(?:\s*criteria)?)\s*[:：]\s*/i;
const CHECK = /^(?:확인\s*방법|검증\s*방법|how to (?:check|verify|validate))\s*[:：]\s*/i;
const ITEM = (letter: 'R' | 'F') => new RegExp(`^(?:#{2,5}\\s*|[-*+]\\s+|\\d+\\.\\s+)?\\**\\s*${letter}\\s*-?\\s*0*(\\d+)\\s*[.:)\\]]?\\**\\s*(.*)$`, 'i');
const REQUIREMENT_ITEM = ITEM('R');
const FEATURE_ITEM = ITEM('F');

/** Every E-number cited in a piece of text: [E1], [E1, E3], [E-2], (E4). */
export function citedQuotes(text: string) {
  const numbers = new Set<number>();
  for (const group of text.matchAll(/[[(]\s*(E\s*-?\s*\d+(?:\s*[,，/]\s*E?\s*-?\s*\d+)*)\s*[\])]/gi)) {
    for (const n of group[1].matchAll(/\d+/g)) numbers.add(Number(n[0]));
  }
  return [...numbers];
}

const stripCitations = (text: string) => text.replace(/\s*[[(]\s*E\s*-?\s*\d+(?:\s*[,，/]\s*E?\s*-?\s*\d+)*\s*[\])]/gi, '').trim();
const stripMarks = (text: string) => text.replace(/\*\*|__|`/g, '').trim();
const bulletText = (line: string) => line.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '').trim();
const isBullet = (line: string) => /^\s*(?:[-*+•]|\d+[.)])\s+/.test(line);
const isNone = (text: string) => /^(?:없음|해당 없음|none|n\/a)\.?$/i.test(text.trim());

function sectionOf(heading: string): Section | null {
  const label = stripMarks(heading.replace(/^#+\s*/, '')).replace(/[:：].*$/, '');
  return SECTIONS.find(([, pattern]) => pattern.test(label))?.[0] ?? null;
}

type Item = { number: number; head: string; body: string[] };

/** Splits a section into items that start with R1/F1-style lines; text before the first item is ignored. */
function items(lines: string[], pattern: RegExp): Item[] {
  const found: Item[] = [];
  for (const line of lines) {
    const match = pattern.exec(line.trim());
    if (match && match[2]) found.push({ number: Number(match[1]), head: match[2], body: [] });
    else if (found.length && line.trim()) found[found.length - 1].body.push(line.trim());
  }
  return found;
}

const list = (lines: string[]) => lines.filter(isBullet).map((line) => stripMarks(bulletText(line))).filter((line) => line && !isNone(line));
const prose = (lines: string[]) => lines.map((line) => stripMarks(line.replace(/^>\s*/, ''))).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Markdown PRD -> raw spec. Requirement numbers the model gave (R3) are mapped to their position, which is what the
 * raw format's feature links use. Returns null when no requirement could be read: the caller then asks for JSON.
 */
export function parsePrdMarkdown(markdown: string): RawSpec | null {
  const text = markdown.replace(/^```(?:markdown|md)?\s*$/gim, '');
  const buckets = new Map<Section, string[]>();
  let current: Section | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    // R1/F1 lines are items even when written as headings ("### R1. 사용자는 ..." would otherwise read as the users
    // section), so they are ruled out first. An inline "# 한 줄 요약: ..." keeps its text.
    const item = REQUIREMENT_ITEM.test(line.trim()) || FEATURE_ITEM.test(line.trim());
    const heading = !item && (/^#{1,6}\s+\S/.test(line) || /^\*\*[^*]{2,40}\*\*\s*$/.test(line.trim()));
    if (heading) {
      const section = sectionOf(line);
      if (section) {
        current = section;
        const inline = line.replace(/^#+\s*/, '').split(/[:：]/).slice(1).join(':').trim();
        buckets.set(section, inline ? [inline] : buckets.get(section) ?? []);
        continue;
      }
    }
    if (current) buckets.get(current)?.push(line);
  }

  const requirementItems = items(buckets.get('requirements') ?? [], REQUIREMENT_ITEM);
  if (!requirementItems.length) return null;
  const position = new Map<number, number>();
  const requirements = requirementItems.map((item, index) => {
    if (!position.has(item.number)) position.set(item.number, index + 1);
    const acceptance: string[] = [];
    const detail: string[] = [];
    let check = '';
    for (const line of item.body) {
      const plain = stripMarks(bulletText(line));
      if (ACCEPTANCE.test(plain)) acceptance.push(stripCitations(plain.replace(ACCEPTANCE, '')));
      else if (CHECK.test(plain)) check = plain.replace(CHECK, '');
      else detail.push(plain);
    }
    const priority = /\bP([012])\b/i.exec(item.head)?.[1];
    const title = stripMarks(stripCitations(item.head).replace(/\[?\s*\bP[012]\b\s*\]?/i, '')).replace(/^[\s.:-]+/, '');
    const evidence = [...new Set([...citedQuotes(item.head), ...citedQuotes(item.body.join(' '))])];
    return { title, detail: stripCitations(detail.join(' ')), evidence, ...(priority ? { priority: `P${priority}` } : {}), acceptance, ...(check ? { check } : {}) };
  });

  const features = items(buckets.get('features') ?? [], FEATURE_ITEM).map((item) => {
    const refs = [...item.head.matchAll(/R\s*-?\s*0*(\d+)/gi)].map((match) => Number(match[1]));
    const fromBody = refs.length ? [] : [...item.body.join(' ').matchAll(/R\s*-?\s*0*(\d+)/gi)].map((match) => Number(match[1]));
    const title = stripMarks(item.head.replace(/\s*[([][^)\]]*R\s*-?\s*\d+[^)\]]*[)\]]\s*$/i, '')).replace(/^[\s.:-]+/, '');
    return { title, detail: stripCitations(prose(item.body.map(bulletText))), requirements: [...refs, ...fromBody].flatMap((n) => position.get(n) ?? []) };
  });

  const rivals = list(buckets.get('rivals') ?? []).flatMap((line) => {
    const [name, ...rest] = line.split(/[:：]/);
    const [misses, answer = ''] = rest.join(':').split(/→|->/);
    return name && misses ? [{ name: name.trim(), misses: misses.trim(), answer: answer.trim() }] : [];
  });

  const summaryLines = (buckets.get('summary') ?? []).map((line) => line.trim()).filter(Boolean);
  return {
    summary: stripMarks(stripCitations(summaryLines.map(bulletText).join(' '))),
    background: prose(buckets.get('background') ?? []),
    target_users: list(buckets.get('users') ?? []),
    scenario: prose(buckets.get('scenario') ?? []),
    goals: list(buckets.get('goals') ?? []),
    non_goals: list(buckets.get('nonGoals') ?? []),
    requirements,
    features,
    screens: [],
    rivals,
    risks: list(buckets.get('risks') ?? []),
    assumptions: list(buckets.get('assumptions') ?? []),
    metrics: list(buckets.get('metrics') ?? []),
    open_questions: list(buckets.get('openQuestions') ?? []),
  };
}
