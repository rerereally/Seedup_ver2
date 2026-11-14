// The evidence-traced spec: every requirement cites verified quotes, every feature serves a requirement,
// every screen serves a feature. Pure functions only, so the browser can re-render exports after edits.
import { PLATFORM_LABELS } from './types';
import type { Evidence } from './types';

export type ReadinessSlots = {
  /** ① Inputs and state conditions */
  inputs: string[];
  /** ② Business rules */
  rules: string[];
  /** ③ Exceptions and error handling */
  errors: string[];
  /** ④ Permissions and access control */
  access: string[];
  /** ⑤ Data and schema requirements */
  data: string[];
  /** ⑥ Tests and done criteria */
  done: string[];
};

export const SLOT_LABELS: Record<keyof ReadinessSlots, string> = {
  inputs: '입력·상태 조건',
  rules: '비즈니스 규칙',
  errors: '예외·오류 처리',
  access: '권한·접근 제어',
  data: '데이터·스키마 요건',
  done: '테스트·완료 기준',
};

export const SLOT_KEYS = Object.keys(SLOT_LABELS) as Array<keyof ReadinessSlots>;

export type SpecRequirement = { id: string; title: string; detail: string; evidence: number[] };
export type SpecFeature = { id: string; title: string; detail: string; requirementIds: string[]; slots: ReadinessSlots | null };
export type SpecScreen = { id: string; name: string; does: string; featureIds: string[] };

export type Spec = {
  summary: string;
  targetUsers: string[];
  requirements: SpecRequirement[];
  /** Requirements no collected quote backs. Never built until validated. */
  hypotheses: SpecRequirement[];
  features: SpecFeature[];
  screens: SpecScreen[];
  nonGoals: string[];
  risks: string[];
  metrics: string[];
  /** True when the evidence is below the qualification bar: a hypothesis draft, not a verified PRD. */
  draft: boolean;
};

export type SpecInput = {
  title: string;
  problem: string;
  gap: string;
  evidence: Evidence[];
  competitors: string[];
};

export type ExportFormat = 'agents' | 'claude' | 'cursor';

export const EXPORT_FILES: Record<ExportFormat, string> = { agents: 'AGENTS.md', claude: 'CLAUDE.md', cursor: '.cursorrules' };

type RawRow = { title?: unknown; detail?: unknown; evidence?: unknown; requirements?: unknown; features?: unknown; name?: unknown; does?: unknown };

export type RawSpec = {
  summary?: unknown;
  target_users?: unknown;
  requirements?: unknown;
  features?: unknown;
  screens?: unknown;
  non_goals?: unknown;
  risks?: unknown;
  metrics?: unknown;
};

const text = (value: unknown, limit = 400) => String(value ?? '').trim().slice(0, limit);
const stringList = (value: unknown, limit: number, length = 200) =>
  (Array.isArray(value) ? value : []).map((item) => text(item, length)).filter(Boolean).slice(0, limit);
const numbers = (value: unknown, max: number) =>
  [...new Set((Array.isArray(value) ? value : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))];
const id = (prefix: string, index: number) => `${prefix}-${String(index + 1).padStart(2, '0')}`;

export const emptySlots = (): ReadinessSlots => ({ inputs: [], rules: [], errors: [], access: [], data: [], done: [] });

export function normalizeSlots(raw: unknown): ReadinessSlots | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const slots = emptySlots();
  for (const key of SLOT_KEYS) slots[key] = stringList(record[key], 5, 240);
  return SLOT_KEYS.some((key) => slots[key].length) ? slots : null;
}

/**
 * The model drafts, the server decides. A requirement stays a requirement only if it cites evidence the user
 * collected; anything else becomes a hypothesis. Features must serve a kept requirement, screens a kept feature,
 * so nothing in the spec floats free of the evidence chain. Indexes in the raw draft are 1-based.
 */
export function normalizeSpec(raw: RawSpec, evidenceCount: number, draft = false): Spec {
  const rows = (Array.isArray(raw.requirements) ? raw.requirements : []).slice(0, 12).flatMap((row) => {
    const record = (row ?? {}) as RawRow;
    const title = text(record.title, 120);
    return title ? [{ title, detail: text(record.detail), evidence: numbers(record.evidence, evidenceCount) }] : [];
  });
  // Raw requirement position (1-based) -> kept requirement id, for features that cite requirements by number.
  const requirementId = new Map<number, string>();
  const requirements: SpecRequirement[] = [];
  const hypotheses: SpecRequirement[] = [];
  rows.forEach((row, index) => {
    if (row.evidence.length) {
      const kept = { id: id('R', requirements.length), ...row };
      requirements.push(kept);
      requirementId.set(index + 1, kept.id);
    } else {
      hypotheses.push({ id: id('H', hypotheses.length), ...row, evidence: [] });
    }
  });

  const featureId = new Map<number, string>();
  const features: SpecFeature[] = [];
  (Array.isArray(raw.features) ? raw.features : []).slice(0, 10).forEach((row, index) => {
    const record = (row ?? {}) as RawRow;
    const title = text(record.title, 120);
    const requirementIds = numbers(record.requirements, rows.length).flatMap((n) => requirementId.get(n) ?? []);
    if (!title || !requirementIds.length) return;
    const kept = { id: id('F', features.length), title, detail: text(record.detail), requirementIds, slots: null };
    features.push(kept);
    featureId.set(index + 1, kept.id);
  });

  const screens: SpecScreen[] = [];
  (Array.isArray(raw.screens) ? raw.screens : []).slice(0, 8).forEach((row) => {
    const record = (row ?? {}) as RawRow;
    const name = text(record.name, 80);
    const featureIds = numbers(record.features, features.length + 10).flatMap((n) => featureId.get(n) ?? []);
    if (name && featureIds.length) screens.push({ id: id('S', screens.length), name, does: text(record.does, 240), featureIds });
  });

  return {
    summary: text(raw.summary),
    targetUsers: stringList(raw.target_users, 4),
    requirements,
    hypotheses,
    features,
    screens,
    nonGoals: stringList(raw.non_goals, 6),
    risks: stringList(raw.risks, 6),
    metrics: stringList(raw.metrics, 5),
    draft,
  };
}

/** Everything a spec item stands on, both directions: E <- R <- F <- S. Used to highlight a chain on screen. */
export function traceOf(spec: Spec, itemId: string) {
  const ids = new Set<string>([itemId]);
  const evidence = new Set<number>();
  const addRequirement = (requirement: SpecRequirement | undefined) => {
    if (!requirement) return;
    ids.add(requirement.id);
    requirement.evidence.forEach((n) => evidence.add(n));
  };
  const addFeatureUp = (feature: SpecFeature | undefined) => {
    if (!feature) return;
    ids.add(feature.id);
    feature.requirementIds.forEach((rid) => addRequirement(spec.requirements.find((row) => row.id === rid)));
  };
  if (itemId.startsWith('E-')) {
    const n = Number(itemId.slice(2));
    evidence.add(n);
    for (const requirement of spec.requirements.filter((row) => row.evidence.includes(n))) ids.add(requirement.id);
  }
  if (itemId.startsWith('R-')) addRequirement(spec.requirements.find((row) => row.id === itemId));
  if (itemId.startsWith('F-')) addFeatureUp(spec.features.find((row) => row.id === itemId));
  if (itemId.startsWith('S-')) {
    const screen = spec.screens.find((row) => row.id === itemId);
    screen?.featureIds.forEach((fid) => addFeatureUp(spec.features.find((row) => row.id === fid)));
  }
  // Downward: features that serve a traced requirement, screens that show a traced feature.
  for (const feature of spec.features) if (feature.requirementIds.some((rid) => ids.has(rid)) && (itemId.startsWith('R-') || itemId.startsWith('E-'))) ids.add(feature.id);
  for (const screen of spec.screens) if (screen.featureIds.some((fid) => ids.has(fid)) && !itemId.startsWith('S-')) ids.add(screen.id);
  return { ids, evidence };
}

const mermaidLabel = (value: string) => value.replace(/["\n\r]/g, ' ').replace(/[[\]{}()<>]/g, ' ').trim().slice(0, 60);

/** User flow as Mermaid, in the order the screens were drafted. GitHub and most IDEs render it. */
export function mermaidFlow(spec: Spec) {
  if (!spec.screens.length) return '';
  const nodes = spec.screens.map((screen) => `  ${screen.id.replace('-', '')}["${screen.id} ${mermaidLabel(screen.name)}"]`);
  const edges = spec.screens.slice(1).map((screen, index) => `  ${spec.screens[index].id.replace('-', '')} --> ${screen.id.replace('-', '')}`);
  return ['flowchart LR', ...nodes, ...edges].join('\n');
}

function evidenceSection(evidence: Evidence[]) {
  return evidence.map((item, index) => {
    const korean = item.quoteKo ? `\n   - 번역: ${item.quoteKo}` : '';
    return `${index + 1}. [E-${index + 1}] "${item.quote}" ([${PLATFORM_LABELS[item.platform]} 원문](${item.url}))${korean}`;
  }).join('\n');
}

const cite = (evidence: number[]) => evidence.map((n) => `E-${n}`).join(', ');
const bullets = (items: string[], empty: string) => (items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`);

function slotLines(slots: ReadinessSlots | null, english = false) {
  if (!slots) return english ? '  - Readiness slots not filled yet. Ask before guessing.' : '  - 개발 준비 슬롯이 아직 비어 있습니다. 추측하지 말고 먼저 물어보세요.';
  return SLOT_KEYS.map((key) => {
    const label = english ? key : SLOT_LABELS[key];
    const values = slots[key];
    return `  - ${label}: ${values.length ? values.join(' / ') : english ? '(open question)' : '(정해지지 않음, 먼저 물어볼 것)'}`;
  }).join('\n');
}

export function renderSpecMarkdown(input: SpecInput, spec: Spec) {
  const requirements = spec.requirements.map((row) => `### ${row.id}. ${row.title}\n${row.detail}\n\n근거: ${cite(row.evidence)}`).join('\n\n');
  const features = spec.features.map((row) => `### ${row.id}. ${row.title}\n${row.detail}\n\n충족하는 요구사항: ${row.requirementIds.join(', ')}\n\n개발 준비 슬롯\n${slotLines(row.slots)}`).join('\n\n');
  const screens = spec.screens.map((row) => `- **${row.id}. ${row.name}**${row.does ? `: ${row.does}` : ''} (${row.featureIds.join(', ')})`).join('\n');
  const flow = mermaidFlow(spec);
  const hypotheses = spec.hypotheses.map((row) => `- **${row.id}. ${row.title}**: ${row.detail}`).join('\n');
  return `# ${input.title} PRD
${spec.draft ? '\n> 가설 초안: 근거가 기준(증언 3건, 플랫폼 2종)에 못 미칩니다. 사용자 확인 전에는 검증된 PRD로 쓰지 마세요.\n' : ''}
## 한 줄 요약
${spec.summary}

## 해결할 문제
${input.problem}

${input.gap ? `## 기존 도구가 남긴 빈틈\n${input.gap}\n\n` : ''}## 대상 사용자
${bullets(spec.targetUsers, '정의되지 않음')}

## 요구사항 (증언 → R)
${requirements || '근거로 뒷받침되는 요구사항이 없습니다.'}

## 기능 명세 (R → F)
${features || '요구사항을 충족하는 기능이 아직 없습니다.'}

${screens ? `## 화면 (F → S)\n증언에서 나온 것이 아니라 모델이 제안한 순서입니다. 첫 사용자와 확인한 뒤 고치세요.\n\n${screens}\n\n` : ''}${flow ? `## 유저플로우\n\`\`\`mermaid\n${flow}\n\`\`\`\n\n` : ''}${hypotheses ? `## 검증이 필요한 가설\n근거 문장이 뒷받침하지 않아 요구사항에서 제외한 항목입니다.\n\n${hypotheses}\n\n` : ''}## 하지 않을 것
${bullets(spec.nonGoals, '정의되지 않음')}

## 위험 요소
${bullets(spec.risks, '정의되지 않음')}

## 성공 지표
${bullets(spec.metrics, '정의되지 않음')}

${input.competitors.length ? `## 이미 있는 도구\n${input.competitors.map((name) => `- ${name}`).join('\n')}\n\n` : ''}## 근거 원문
${evidenceSection(input.evidence)}
`;
}

/** A brief an AI coding tool follows directly. The three formats share one body so they never drift apart. */
export function renderAgentBrief(input: SpecInput, spec: Spec, format: ExportFormat = 'agents') {
  const intro: Record<ExportFormat, string> = {
    agents: `# ${input.title}\n\nInstructions for coding agents (Codex and others) working in this repository.`,
    claude: `# CLAUDE.md: ${input.title}\n\nClaude Code reads this file at the start of every session in this repository.`,
    cursor: `# ${input.title}: Cursor rules\n\nYou are working in a project defined by the spec below. Follow it exactly.`,
  };
  const tasks = spec.features.map((feature) => {
    const requirements = feature.requirementIds.map((rid) => spec.requirements.find((row) => row.id === rid)).filter(Boolean);
    return `- [ ] ${feature.id}. ${feature.title}: ${feature.detail}\n  - Serves: ${requirements.map((row) => `${row!.id} ${row!.title} (evidence ${cite(row!.evidence)})`).join('; ')}\n${slotLines(feature.slots, true)}`;
  }).join('\n');
  const requirementTasks = spec.requirements.map((row) => `- [ ] ${row.id}. ${row.title}: ${row.detail}`).join('\n');
  const flow = mermaidFlow(spec);
  return `${intro[format]}
${spec.draft ? '\n> HYPOTHESIS DRAFT: the evidence is below the qualification bar. Confirm with real users before building beyond a prototype.\n' : ''}
## Goal
${spec.summary}

## Problem
${input.problem}

## Build these features, in order
${tasks || requirementTasks || '- [ ] Confirm the problem with users before building.'}

${spec.screens.length ? `## Screens, in order (a draft, confirm with users)\n${spec.screens.map((screen) => `${screen.id}. ${screen.name}${screen.does ? `: ${screen.does}` : ''} (${screen.featureIds.join(', ')})`).join('\n')}\n\n` : ''}${flow ? `## User flow\n\`\`\`mermaid\n${flow}\n\`\`\`\n\n` : ''}## Do not build
${bullets(spec.nonGoals, 'Nothing listed yet.')}

## Done when
${bullets(spec.metrics, 'Agree on a measurable outcome first.')}

## Rules
- Ship one feature at a time and keep each change small.
- Every feature must trace to a requirement and every requirement to user evidence below. Do not add work that has no source. Ask first.
- When a readiness slot says "open question", ask instead of guessing.
- Treat these unverified ideas as out of scope until validated: ${spec.hypotheses.map((row) => `${row.id} ${row.title}`).join(', ') || 'none'}.

## User evidence
${evidenceSection(input.evidence)}
`;
}
