// Reads the Markdown PRD the model streamed (format in prd-prompt.ts) back into the raw spec that normalizeSpec checks.
// Models drift from the format in small ways (bold item ids, bullets instead of ###, citations in the body), so each
// part has a tolerant reading; anything that cannot be read is left out rather than guessed.
import type { RawSpec } from './spec';

type DesignSection = 'architecture' | 'dataModel' | 'interfaces' | 'stack' | 'milestones';
type Section = 'summary' | 'background' | 'users' | 'scenario' | 'goals' | 'nonGoals' | 'requirements' | 'hypotheses' | 'features' | 'rivals' | 'risks' | 'assumptions' | 'metrics' | 'openQuestions' | 'differentiation' | 'review' | DesignSection;

// Order matters: the first match wins, so "non-goals" is tried before "goals" and "success metrics" before "users".
const SECTIONS: Array<[Section, RegExp]> = [
  ['summary', /한\s*줄\s*요약|요약|summary/i],
  ['background', /배경|background/i],
  ['scenario', /사용\s*장면|장면|scenario/i],
  ['nonGoals', /하지\s*않을|범위\s*밖|non-?goals|out of scope/i],
  ['goals', /목표|goals?/i],
  ['users', /대상|사용자|target|users?/i],
  ['requirements', /요구\s*사항|requirements?/i],
  ['hypotheses', /^(?:검증이 필요한 가설|hypotheses to validate)$/i],
  ['review', /^(?:검토 의견|review notes)$/i],
  ['differentiation', /^(?:차별점|우리만 하는 한 가지|differentiation|one differentiator)$/i],
  ['rivals', /이미\s*있는\s*도구|경쟁|existing tools|competitors|rivals/i],
  ['features', /기능|features?/i],
  ['risks', /위험|risks?/i],
  ['assumptions', /가정|assumptions?/i],
  ['metrics', /지표|완료\s*기준|metrics|success/i],
  ['openQuestions', /열린\s*질문|open questions?/i],
];
const DESIGN_HEAD = /^(?:기술\s*설계|technical design)$/i;
const DESIGN_SECTIONS: Array<[DesignSection, RegExp]> = [
  ['architecture', /^(?:구조|아키텍처|architecture)$/i],
  ['dataModel', /^(?:데이터\s*모델|data model)$/i],
  ['interfaces', /^(?:인터페이스|interfaces?)$/i],
  ['stack', /^(?:스택(?:과 이유)?|stack(?: and rationale)?)$/i],
  ['milestones', /^(?:구현\s*순서|implementation order|milestones?)$/i],
];
const COMPETITOR_BASIS = /^(?:경쟁 도구 설명|competitor listing)\s*[:：]\s*/i;

const ACCEPTANCE = /^(?:\[[ xX]\]\s+)?(?:수락\s*기준|완료\s*기준|acceptance(?:\s*criteria)?)\s*[:：]\s*/i;
const CHECK = /^(?:확인\s*방법|검증\s*방법|how to (?:check|verify|validate))\s*[:：]\s*/i;
const EVIDENCE_LINE = /^(?:근거|evidence)\s*[:：]\s*/i;
const SENTENCE_LABEL = /^\[(?:증언|사실|추정|testimony|fact|inference)\]\s*/i;
const LEADING_CITATIONS = /^(?:\[\s*E\s*-?\s*\d+(?:\s*[,，/]\s*E?\s*-?\s*\d+)*\s*\]\s*)+/i;
const ITEM = (letter: 'R' | 'H' | 'F') => new RegExp(`^(?:#{2,5}\\s*|[-*+]\\s+|\\d+\\.\\s+)?\\**\\s*${letter}\\s*-?\\s*0*(\\d+)\\s*[.:)\\]]?\\**\\s*(.*)$`, 'i');
// The readiness slots renderSpecMarkdown writes under a feature, read back so a saved PRD keeps them. Labels come in
// Korean, English, or as the slot keys themselves (the English agent export); spec.ts owns the labels but imports
// this file, so they are matched by their words here instead of imported.
const SLOTS_HEAD = /^(?:개발 준비 슬롯|development readiness slots)$/i;
// The "Serves: R-01" line renderSpecMarkdown adds: read for the links, kept out of the feature's text.
const SERVES_LINE = /^(?:충족하는 요구사항|serves)\s*[:：]/i;
const OPEN_SLOT_VALUE = /^\((?:open question|정해지지 않음, 먼저 물어볼 것)\)$/i;
const SLOT_WORDS: Array<[string, RegExp]> = [
  ['inputs', /^(?:inputs?\b|입력)/i], ['rules', /^(?:rules\b|business rules|비즈니스 규칙)/i], ['errors', /^(?:errors?\b|예외)/i],
  ['access', /^(?:access\b|permissions?|권한)/i], ['data', /^(?:data\b|데이터)/i], ['done', /^(?:done\b|tests?\b|테스트)/i],
];

/** Splits a feature's body into its text and the readiness slots written after the slots heading, if any. */
function featureSlots(body: string[]) {
  const start = body.findIndex((line) => SLOTS_HEAD.test(stripMarks(line)));
  if (start < 0) return { text: body, slots: undefined };
  const slots: Record<string, string[]> = {};
  for (const line of body.slice(start + 1)) {
    const item = bulletText(line);
    const colon = item.search(/[:：]/);
    const key = colon > 0 ? SLOT_WORDS.find(([, pattern]) => pattern.test(item.slice(0, colon).trim()))?.[0] : undefined;
    if (!key) continue;
    const value = item.slice(colon + 1).trim();
    slots[key] = OPEN_SLOT_VALUE.test(value) ? [] : value.split(' / ').map((part) => part.trim()).filter(Boolean);
  }
  return { text: body.slice(0, start), slots };
}

const REQUIREMENT_ITEM = ITEM('R');
const HYPOTHESIS_ITEM = ITEM('H');
const FEATURE_ITEM = ITEM('F');

/** Every E-number cited in a piece of text: [E1], [E1, E3], [E-2], (E4). */
export function citedQuotes(text: string) {
  const numbers = new Set<number>();
  for (const group of text.matchAll(/[[(]\s*(E\s*-?\s*\d+(?:\s*[,，/]\s*E?\s*-?\s*\d+)*)\s*[\])]/gi)) {
    for (const n of group[1].matchAll(/\d+/g)) numbers.add(Number(n[0]));
  }
  return [...numbers];
}

/** Keep a bracketed citation after punctuation with the sentence it follows. */
export function prdSentenceParts(text: string) {
  const parts: string[] = [];
  for (const chunk of text.trim().split(/(?<=[.!?。！？])\s+|\r?\n/u)) {
    const labeled = SENTENCE_LABEL.test(chunk);
    let line = chunk.replace(SENTENCE_LABEL, '').trim();
    const citations = labeled ? undefined : LEADING_CITATIONS.exec(line)?.[0];
    if (citations && parts.length) {
      parts[parts.length - 1] += ` ${citations.trim()}`;
      line = line.slice(citations.length).replace(SENTENCE_LABEL, '').trim();
    }
    if (line) parts.push(line);
  }
  return parts;
}

const stripCitations = (text: string) => text.replace(/\s*[[(]\s*E\s*-?\s*\d+(?:\s*[,，/]\s*E?\s*-?\s*\d+)*\s*[\])]/gi, '').trim();
const stripMarks = (text: string) => text.replace(/\*\*|__|`/g, '').trim();
const bulletText = (line: string) => line.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '').trim();
const isBullet = (line: string) => /^\s*(?:[-*+•]|\d+[.)])\s+/.test(line);
const isNone = (text: string) => /^(?:없음|해당 없음|none|n\/a)\.?$/i.test(text.trim());

const headingLabel = (heading: string) => stripMarks(heading.replace(/^#+\s*/, '')).replace(/[:：].*$/, '').trim();

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
  let inDesign = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    // R1/F1 lines are items even when written as headings ("### R1. 사용자는 ..." would otherwise read as the users
    // section), so they are ruled out first. An inline "# 한 줄 요약: ..." keeps its text.
    const item = REQUIREMENT_ITEM.test(line.trim()) || HYPOTHESIS_ITEM.test(line.trim()) || FEATURE_ITEM.test(line.trim());
    const heading = !item && (/^#{1,6}\s+\S/.test(line) || /^\*\*[^*]{2,40}\*\*\s*$/.test(line.trim()));
    if (heading) {
      const label = headingLabel(line);
      if (/^#{1,2}\s/.test(line)) {
        inDesign = DESIGN_HEAD.test(label);
        if (inDesign) { current = null; continue; }
      }
      const section = (inDesign ? DESIGN_SECTIONS : SECTIONS).find(([, pattern]) => pattern.test(label))?.[0];
      if (section) {
        current = section;
        const inline = line.replace(/^#+\s*/, '').split(/[:：]/).slice(1).join(':').trim();
        buckets.set(section, inline ? [inline] : buckets.get(section) ?? []);
        continue;
      }
      if (/^#{1,2}\s/.test(line)) {
        current = null;
        continue;
      }
    }
    if (current) buckets.get(current)?.push(line);
  }

  const requirementItems = [
    ...items(buckets.get('requirements') ?? [], REQUIREMENT_ITEM).map((item) => ({ ...item, kind: 'R' })),
    ...items(buckets.get('hypotheses') ?? [], HYPOTHESIS_ITEM).map((item) => ({ ...item, kind: 'H' })),
  ];
  if (!requirementItems.length) return null;
  const position = new Map<string, number>();
  const requirements = requirementItems.map((item, index) => {
    const key = `${item.kind}${item.number}`;
    if (!position.has(key)) position.set(key, index + 1);
    const acceptance: string[] = [];
    const detail: string[] = [];
    const evidenceLine: number[] = [];
    let check = '';
    for (const line of item.body) {
      const plain = stripMarks(bulletText(line));
      if (ACCEPTANCE.test(plain)) acceptance.push(stripCitations(plain.replace(ACCEPTANCE, '')));
      else if (CHECK.test(plain)) check = plain.replace(CHECK, '');
      else if (EVIDENCE_LINE.test(plain)) evidenceLine.push(...[...plain.matchAll(/\bE-?(\d+)/gi)].map((match) => Number(match[1])));
      else detail.push(plain);
    }
    const priority = /\bP([012])\b/i.exec(item.head)?.[1];
    const title = stripMarks(stripCitations(item.head).replace(/\[?\s*\bP[012]\b\s*\]?/i, '')).replace(/^[\s.:-]+/, '');
    const evidence = item.kind === 'H' ? [] : [...new Set([...citedQuotes(item.head), ...citedQuotes(item.body.join(' ')), ...evidenceLine])];
    return { title, detail: stripCitations(detail.join(' ')), evidence, ...(priority ? { priority: `P${priority}` } : {}), acceptance, ...(check ? { check } : {}) };
  });

  const featurePositions = new Map<number, number>();
  const features = items(buckets.get('features') ?? [], FEATURE_ITEM).map((item, index) => {
    if (!featurePositions.has(item.number)) featurePositions.set(item.number, index + 1);
    const refs = [...item.head.matchAll(/\b([RH])\s*-?\s*0*(\d+)/gi)];
    const links = refs.length ? refs : [...item.body.join(' ').matchAll(/\b([RH])\s*-?\s*0*(\d+)/gi)];
    const title = stripMarks(item.head.replace(/\s*[([][^)\]]*\b[RH]\s*-?\s*\d+[^)\]]*[)\]]\s*$/i, '')).replace(/^[\s.:-]+/, '');
    const { text: lines, slots } = featureSlots(item.body);
    return { title, detail: stripCitations(prose(lines.filter((line) => !SERVES_LINE.test(stripMarks(line))).map(bulletText))), requirements: links.flatMap(([, kind, number]) => position.get(`${kind.toUpperCase()}${Number(number)}`) ?? []), ...(slots ? { slots } : {}) };
  });

  const difference = (buckets.get('differentiation') ?? []).map(bulletText).filter(Boolean);
  const claim = prdSentenceParts(difference.filter((line) => !COMPETITOR_BASIS.test(stripMarks(line))).map(stripMarks).join(' '))[0] ?? '';
  const basis = difference.find((line) => COMPETITOR_BASIS.test(stripMarks(line))) ?? '';
  const [name, ...excerpt] = basis.split('|');
  const technicalDesign = {
    architecture: prose(buckets.get('architecture') ?? []),
    dataModel: list(buckets.get('dataModel') ?? []),
    interfaces: list(buckets.get('interfaces') ?? []),
    stack: list(buckets.get('stack') ?? []),
    milestones: list(buckets.get('milestones') ?? []).map((line) => {
      const references = /\(\s*(F\s*-?\s*\d+(?:\s*[,，/]\s*F\s*-?\s*\d+)*)\s*\)\s*\.?$/i.exec(line);
      return {
        title: references ? line.slice(0, references.index).trim() : line,
        featureIds: references ? [...references[1].matchAll(/\d+/g)].flatMap((match) => featurePositions.get(Number(match[0])) ?? []) : [],
      };
    }),
  };

  const rivals = list(buckets.get('rivals') ?? []).flatMap((line) => {
    const [name, ...rest] = line.split(/[:：]/);
    const [misses, answer = ''] = rest.join(':').split(/→|->/);
    return name && misses ? [{ name: name.trim(), misses: misses.trim(), answer: answer.trim() }] : [];
  });

  const summaryLines = (buckets.get('summary') ?? []).map((line) => line.trim()).filter(Boolean);
  return {
    summary: stripMarks(stripCitations(summaryLines.map(bulletText).join(' '))),
    background: prdSentenceParts(prose(buckets.get('background') ?? [])).join(' '),
    target_users: list(buckets.get('users') ?? []),
    scenario: prose(buckets.get('scenario') ?? []),
    goals: list(buckets.get('goals') ?? []),
    non_goals: list(buckets.get('nonGoals') ?? []),
    requirements,
    features,
    screens: [],
    rivals,
    ...(claim ? { differentiation: { claim: stripCitations(claim), evidence: citedQuotes(claim), competitor: { name: stripMarks(name).replace(COMPETITOR_BASIS, ''), quote: excerpt.join('|').trim() } } } : {}),
    ...(Object.values(technicalDesign).some((part) => part.length) ? { technicalDesign } : {}),
    risks: list(buckets.get('risks') ?? []).map((line) => prdSentenceParts(line).join(' ')),
    assumptions: list(buckets.get('assumptions') ?? []).map((line) => prdSentenceParts(line).join(' ')),
    metrics: list(buckets.get('metrics') ?? []),
    open_questions: list(buckets.get('openQuestions') ?? []),
    review_notes: list(buckets.get('review') ?? []),
  };
}

export type PrdGlance = { requirements: Array<{ title: string; priority?: string }>; features: number };

/** What a saved PRD holds, read back from its markdown for a thumbnail: the requirement lines and how many features. */
export function prdGlance(markdown: string | null): PrdGlance | null {
  const spec = markdown ? parsePrdMarkdown(markdown) : null;
  if (!spec) return null;
  const requirements = (Array.isArray(spec.requirements) ? spec.requirements : []) as Array<{ title?: unknown; priority?: unknown }>;
  return {
    requirements: requirements.map((row) => ({ title: String(row.title ?? ''), priority: row.priority ? String(row.priority) : undefined })).filter((row) => row.title),
    features: Array.isArray(spec.features) ? spec.features.length : 0,
  };
}
