// The evidence-traced spec: every requirement cites verified quotes, every feature serves a requirement,
// every screen serves a feature. Pure functions only, so the browser can re-render exports after edits.
import { translator } from '../i18n';
import type { Lang } from '../i18n';
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

export const SLOT_LABELS_EN: Record<keyof ReadinessSlots, string> = {
  inputs: 'Inputs and state',
  rules: 'Business rules',
  errors: 'Errors and edge cases',
  access: 'Permissions',
  data: 'Data and schema',
  done: 'Tests and done criteria',
};

export const slotLabels = (lang: Lang = 'ko') => (lang === 'en' ? SLOT_LABELS_EN : SLOT_LABELS);

export const SLOT_KEYS = Object.keys(SLOT_LABELS) as Array<keyof ReadinessSlots>;

export type Priority = 'P0' | 'P1' | 'P2';
/**
 * priority: P0 the first version is useless without it, P1 it ships in the first version, P2 later.
 * acceptance: conditions a test can check. check: for a line no quote backs, how to find out if it is true.
 */
export type SpecRequirement = { id: string; title: string; detail: string; evidence: number[]; priority?: Priority; acceptance?: string[]; check?: string };
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
  /** Cut to 2 or 3 features in plain words for someone who picked beginner at onboarding. */
  beginner?: boolean;
  /** Reverse spec only: what the repository already has (its current IA), which new work must not break. */
  existing?: Array<{ name: string; does: string }>;
  /** Language the model wrote in; exports and follow-up calls use the same one. */
  lang?: Lang;
  /** Started from the user's own idea: features may serve hypotheses, which stay marked as unverified. */
  origin?: 'idea';
  /** Each listed competitor: what it misses for these users and how this product answers it. Names only from the input. */
  rivals?: SpecRival[];
  /** Why this is worth building, in prose; [E1]-style tags cite the quotes. */
  background?: string;
  /** One concrete moment of a target user meeting the problem and the product. */
  scenario?: string;
  goals?: string[];
  /** What the plan takes for granted without proof. */
  assumptions?: string[];
  /** Decisions nobody has made yet; the PRD asks instead of guessing. */
  openQuestions?: string[];
};

export type SpecRival = { name: string; misses: string; answer: string };

/** Keeps only rivals the input actually listed, so the model cannot invent a competitor. */
export function normalizeRivals(raw: unknown, competitors: string[]): SpecRival[] {
  const known = new Map(competitors.map((name) => [name.toLowerCase(), name]));
  return (Array.isArray(raw) ? raw : []).slice(0, 8).flatMap((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const name = known.get(text(record.name, 120).toLowerCase());
    const misses = text(record.misses, 240);
    return name && misses ? [{ name, misses, answer: text(record.answer, 240) }] : [];
  });
}

export type SpecInput = {
  title: string;
  problem: string;
  gap: string;
  evidence: Evidence[];
  competitors: string[];
  /** "name: what it does" for each competitor, from the product search, so the PRD says what a tool misses from its listing instead of from memory. */
  competitorNotes?: string[];
};

export type ExportFormat = 'agents' | 'claude' | 'cursor' | 'prompt';

/** Where each brief goes. `prompt` is no repo file: it is pasted as the first message in Lovable, Bolt, v0 or Replit. */
export const EXPORT_FILES: Record<ExportFormat, string> = { agents: 'AGENTS.md', claude: 'CLAUDE.md', cursor: '.cursor/rules/seedup.mdc', prompt: 'prompt.md' };

type RawRow = { title?: unknown; detail?: unknown; evidence?: unknown; requirements?: unknown; features?: unknown; name?: unknown; does?: unknown; priority?: unknown; acceptance?: unknown; check?: unknown };

export type RawSpec = {
  summary?: unknown;
  target_users?: unknown;
  requirements?: unknown;
  features?: unknown;
  screens?: unknown;
  non_goals?: unknown;
  risks?: unknown;
  metrics?: unknown;
  existing?: unknown;
  rivals?: unknown;
  background?: unknown;
  scenario?: unknown;
  goals?: unknown;
  assumptions?: unknown;
  open_questions?: unknown;
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
export function normalizeSpec(raw: RawSpec, evidenceCount: number, draft = false, options: { idea?: boolean } = {}): Spec {
  const rows = (Array.isArray(raw.requirements) ? raw.requirements : []).slice(0, 12).flatMap((row) => {
    const record = (row ?? {}) as RawRow;
    const title = text(record.title, 120);
    if (!title) return [];
    const priority = typeof record.priority === 'string' && /^P[012]$/.test(record.priority) ? (record.priority as Priority) : undefined;
    const acceptance = stringList(record.acceptance, 4, 240);
    const check = text(record.check, 300);
    return [{ title, detail: text(record.detail, 600), evidence: numbers(record.evidence, evidenceCount), ...(priority ? { priority } : {}), ...(acceptance.length ? { acceptance } : {}), ...(check ? { check } : {}) }];
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
      const kept = { id: id('H', hypotheses.length), ...row, evidence: [] };
      hypotheses.push(kept);
      // From an idea, what the user asked for is a real (if unverified) requirement that features may serve.
      if (options.idea) requirementId.set(index + 1, kept.id);
    }
  });

  const featureId = new Map<number, string>();
  const features: SpecFeature[] = [];
  (Array.isArray(raw.features) ? raw.features : []).slice(0, 10).forEach((row, index) => {
    const record = (row ?? {}) as RawRow;
    const title = text(record.title, 120);
    const requirementIds = numbers(record.requirements, rows.length).flatMap((n) => requirementId.get(n) ?? []);
    if (!title || !requirementIds.length) return;
    const kept = { id: id('F', features.length), title, detail: text(record.detail, 600), requirementIds, slots: null };
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
    metrics: stringList(raw.metrics, 6),
    draft,
    ...(text(raw.background, 1500) ? { background: text(raw.background, 1500) } : {}),
    ...(text(raw.scenario, 1000) ? { scenario: text(raw.scenario, 1000) } : {}),
    ...(stringList(raw.goals, 5).length ? { goals: stringList(raw.goals, 5) } : {}),
    ...(stringList(raw.assumptions, 6, 240).length ? { assumptions: stringList(raw.assumptions, 6, 240) } : {}),
    ...(stringList(raw.open_questions, 6, 240).length ? { openQuestions: stringList(raw.open_questions, 6, 240) } : {}),
    ...(options.idea ? { origin: 'idea' as const } : {}),
    ...(Array.isArray(raw.existing) ? {
      existing: raw.existing.slice(0, 12).flatMap((row) => {
        const record = (row ?? {}) as RawRow;
        const name = text(record.name, 80);
        return name ? [{ name, does: text(record.does, 240) }] : [];
      }),
    } : {}),
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

function evidenceSection(evidence: Evidence[], lang: Lang = 'ko') {
  return evidence.map((item, index) => {
    const korean = item.quoteKo && lang === 'ko' ? `\n   - 번역: ${item.quoteKo}` : '';
    const source = item.url ? `[${lang === 'en' ? `${item.platform} source` : `${PLATFORM_LABELS[item.platform]} 원문`}](${item.url})` : lang === 'en' ? "the maker's own notes, not checked against a source" : '만드는 사람이 직접 들은 말, 원문 확인 안 됨';
    return `${index + 1}. [E-${index + 1}] "${item.quote}" (${source})${korean}`;
  }).join('\n');
}

const cite = (evidence: number[]) => evidence.map((n) => `E-${n}`).join(', ');
/** Prose keeps its [E1]-style citations; exports spell them as the evidence list does (E-1). */
const citeTags = (prose: string) => prose.replace(/\[(E\s*-?\s*\d+(?:\s*,\s*E?\s*-?\s*\d+)*)\]/gi, (_, group: string) => `[${[...group.matchAll(/\d+/g)].map((n) => `E-${n[0]}`).join(', ')}]`);
const bullets = (items: string[], empty: string) => (items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`);

function slotLines(slots: ReadinessSlots, english = false, lang: Lang = 'ko') {
  return SLOT_KEYS.map((key) => {
    const label = english ? key : slotLabels(lang)[key];
    const values = slots[key];
    return `  - ${label}: ${values.length ? values.join(' / ') : english ? '(open question)' : '(정해지지 않음, 먼저 물어볼 것)'}`;
  }).join('\n');
}

export function renderSpecMarkdown(input: SpecInput, spec: Spec) {
  const lang = spec.lang ?? 'ko';
  const t = translator(lang);
  const english = lang === 'en';
  const acceptance = (row: SpecRequirement) => (row.acceptance?.length ? `\n${row.acceptance.map((line) => `- ${t('수락 기준', 'Acceptance')}: ${line}`).join('\n')}` : '');
  const priority = (row: SpecRequirement) => (row.priority ? `[${row.priority}] ` : '');
  const requirements = spec.requirements.map((row) => `### ${row.id}. ${priority(row)}${row.title}\n${row.detail ? `${row.detail}\n` : ''}${acceptance(row)}\n\n${t('근거', 'Evidence')}: ${cite(row.evidence)}`).join('\n\n');
  const features = spec.features.map((row) => `### ${row.id}. ${row.title}\n${row.detail}\n\n${t('충족하는 요구사항', 'Serves')}: ${row.requirementIds.join(', ')}${row.slots ? `\n\n${t('개발 준비 슬롯', 'Development readiness slots')}\n${slotLines(row.slots, english, lang)}` : ''}`).join('\n\n');
  const screens = spec.screens.map((row) => `- **${row.id}. ${row.name}**${row.does ? `: ${row.does}` : ''} (${row.featureIds.join(', ')})`).join('\n');
  const flow = mermaidFlow(spec);
  const hypotheses = spec.hypotheses.map((row) => `### ${row.id}. ${priority(row)}${row.title}\n${row.detail ? `${row.detail}\n` : ''}${acceptance(row)}${row.check ? `\n- ${t('확인 방법', 'How to check')}: ${row.check}` : ''}`).join('\n\n');
  const undefinedText = t('정의되지 않음', 'Not defined');
  return `# ${input.title} PRD
${spec.draft ? `\n> ${t('가설 초안: 원문이 기준(원문 3건, 플랫폼 2곳)에 못 미칩니다. 사용자 확인 전에는 검증된 PRD로 쓰지 마세요.', 'Hypothesis draft: the evidence is below the bar (3 quotes, 2 platforms). Do not treat it as a verified PRD before talking to users.')}\n` : ''}
## ${t('한 줄 요약', 'Summary')}
${spec.summary}
${spec.background ? `\n## ${t('배경', 'Background')}\n${citeTags(spec.background)}\n` : ''}
${spec.existing?.length ? `## ${t('기존 구조 (역기획)', 'Existing structure (reverse spec)')}\n${t('지금 레포에 이미 있는 것입니다. 새 기능은 이 구조를 깨지 않아야 합니다.', 'What the repo already has. New work must not break it.')}\n\n${spec.existing.map((row) => `- **${row.name}**${row.does ? `: ${row.does}` : ''}`).join('\n')}\n\n` : ''}## ${t('해결할 문제', 'Problem')}
${input.problem}

${input.gap ? `## ${t('기존 도구가 남긴 빈틈', 'Gap left by existing tools')}\n${input.gap}\n\n` : ''}## ${t('대상 사용자', 'Target users')}
${bullets(spec.targetUsers.map(citeTags), undefinedText)}
${spec.scenario ? `\n## ${t('사용 장면', 'Scenario')}\n${spec.scenario}\n` : ''}${spec.goals?.length ? `\n## ${t('목표', 'Goals')}\n${bullets(spec.goals, undefinedText)}\n` : ''}
## ${t('요구사항 (원문 → R)', 'Requirements (evidence → R)')}
${requirements || t('근거로 뒷받침되는 요구사항이 없습니다.', 'No requirement is backed by evidence yet.')}

## ${t('기능 명세 (R → F)', 'Features (R → F)')}
${features || t('요구사항을 충족하는 기능이 아직 없습니다.', 'No feature serves a requirement yet.')}

${screens ? `## ${t('화면 (F → S)', 'Screens (F → S)')}\n${t('원문에서 나온 것이 아니라 모델이 제안한 순서입니다. 첫 사용자와 확인한 뒤 고치세요.', 'A model-proposed order, not from the evidence. Confirm with first users.')}\n\n${screens}\n\n` : ''}${flow ? `## ${t('유저플로우', 'User flow')}\n\`\`\`mermaid\n${flow}\n\`\`\`\n\n` : ''}${hypotheses ? `## ${t('검증이 필요한 가설', 'Hypotheses to validate')}\n${t('원문이 받쳐 주지 않는 요구사항입니다. 만들기 전에 확인 방법대로 확인하세요.', 'No quote backs these. Check them as described before building.')}\n\n${hypotheses}\n\n` : ''}## ${t('하지 않을 것', 'Non-goals')}
${bullets(spec.nonGoals, undefinedText)}

## ${t('위험 요소', 'Risks')}
${bullets(spec.risks, undefinedText)}
${spec.assumptions?.length ? `\n## ${t('가정', 'Assumptions')}\n${bullets(spec.assumptions, undefinedText)}\n` : ''}
## ${t('성공 지표', 'Success metrics')}
${bullets(spec.metrics, undefinedText)}
${spec.openQuestions?.length ? `\n## ${t('열린 질문', 'Open questions')}\n${bullets(spec.openQuestions, undefinedText)}\n` : ''}
${spec.rivals?.length ? `## ${t('이미 있는 도구가 못 하는 것', 'What existing tools miss')}\n${spec.rivals.map((row) => `- ${row.name}: ${citeTags(row.misses)}${row.answer ? ` → ${row.answer}` : ''}`).join('\n')}\n\n` : input.competitors.length ? `## ${t('이미 있는 도구', 'Existing tools')}\n${input.competitors.map((name) => `- ${name}`).join('\n')}\n\n` : ''}## ${t('근거 원문', 'Source quotes')}
${evidenceSection(input.evidence, lang)}
`;
}

/** A brief an AI coding tool follows directly. The three formats share one body so they never drift apart. */
export function renderAgentBrief(input: SpecInput, spec: Spec, format: ExportFormat = 'agents') {
  if (format === 'prompt') return renderBuilderPrompt(input, spec);
  const intro: Record<Exclude<ExportFormat, 'prompt'>, string> = {
    agents: `# ${input.title}\n\nInstructions for coding agents (Codex and others) working in this repository.`,
    claude: `# CLAUDE.md: ${input.title}\n\nClaude Code reads this file at the start of every session in this repository.`,
    // Cursor reads project rules from .cursor/rules/*.mdc; this front matter applies the rule to every request.
    cursor: `---\ndescription: Product spec for ${input.title.replace(/\s+/g, ' ')}\nalwaysApply: true\n---\n\n# ${input.title}: Cursor rules\n\nYou are working in a project defined by the spec below. Follow it exactly.`,
  };
  const tasks = spec.features.map((feature) => {
    const requirements = feature.requirementIds.map((rid) => spec.requirements.find((row) => row.id === rid)).filter(Boolean);
    const accept = requirements.flatMap((row) => row!.acceptance ?? []);
    return `- [ ] ${feature.id}. ${feature.title}: ${feature.detail}\n  - Serves: ${requirements.map((row) => `${row!.id} ${row!.title} (evidence ${cite(row!.evidence)})`).join('; ')}${accept.length ? `\n  - Acceptance: ${accept.join(' / ')}` : ''}${feature.slots ? `\n${slotLines(feature.slots, true)}` : ''}`;
  }).join('\n');
  const requirementTasks = spec.requirements.map((row) => `- [ ] ${row.id}. ${row.title}: ${row.detail}`).join('\n');
  const flow = mermaidFlow(spec);
  return `${intro[format]}
${spec.draft ? '\n> HYPOTHESIS DRAFT: the evidence is below the qualification bar. Confirm with real users before building beyond a prototype.\n' : ''}
## Goal
${spec.summary}

## Problem
${input.problem}

${spec.existing?.length ? `## Existing structure (keep it working)\n${spec.existing.map((row) => `- ${row.name}${row.does ? `: ${row.does}` : ''}`).join('\n')}\n\n` : ''}## Build these features, in order
${tasks || requirementTasks || '- [ ] Confirm the problem with users before building.'}

${spec.screens.length ? `## Screens, in order (a draft, confirm with users)\n${spec.screens.map((screen) => `${screen.id}. ${screen.name}${screen.does ? `: ${screen.does}` : ''} (${screen.featureIds.join(', ')})`).join('\n')}\n\n` : ''}${flow ? `## User flow\n\`\`\`mermaid\n${flow}\n\`\`\`\n\n` : ''}## Do not build
${bullets(spec.nonGoals, 'Nothing listed yet.')}

## Done when
${bullets(spec.metrics, 'Agree on a measurable outcome first.')}

${spec.openQuestions?.length ? `## Ask the user before deciding\n${bullets(spec.openQuestions, '')}\n\n` : ''}## Rules
- Ship one feature at a time and keep each change small.
- For a Seedup opportunity, call update_feature_status when each feature starts (in_progress) and ends (done with checks or blocked).
- Name the PRD feature in the commit message, for example Implements F-03 (R-2 ← E-5, E-9).
- If the user has enabled commit uploads for this project, call link_commit after each commit with the opportunity slug, commit SHA, message, and changed files (\`git diff --name-only HEAD~1\`).
- Every feature must trace to a requirement and every requirement to user evidence below. Do not add work that has no source. Ask first.
- When a readiness slot says "open question", ask instead of guessing.
- Treat these unverified ideas as out of scope until validated: ${spec.hypotheses.map((row) => `${row.id} ${row.title}`).join(', ') || 'none'}.

## User evidence
${evidenceSection(input.evidence, 'en')}
`;
}

/**
 * The first message for app builders (Lovable, Bolt, v0, Replit) that read no repository files: one paste,
 * only backed features, and a few real quotes so the builder knows who it is for.
 */
export function renderBuilderPrompt(input: SpecInput, spec: Spec) {
  const rows = spec.features.length ? spec.features : spec.requirements;
  const features = rows.map((row, index) => `${index + 1}. ${row.title}: ${row.detail}`).join('\n');
  const quotes = input.evidence.slice(0, 3).map((item) => `- "${item.quote}"`).join('\n');
  const screens = spec.screens.map((row) => `- ${row.name}${row.does ? `: ${row.does}` : ''}`).join('\n');
  return `Build a simple web app: ${input.title}.

What it does: ${spec.summary}
${spec.targetUsers.length ? `Who it is for: ${spec.targetUsers.join(', ').replace(/\s*\[E[^\]]*\]/gi, '')}\n` : ''}
The problem, in real users' words:
${quotes || `- ${input.problem}`}

Build only these features for the first version, one at a time, and show me each one before the next:
${features || '1. Confirm the problem with users before building.'}
${screens ? `\nScreens:\n${screens}\n` : ''}
Do not build yet:
${bullets(spec.nonGoals, 'Anything not listed above.')}

Keep it simple: no sign-up unless a feature needs it, use sample data first, and ask me before adding payments or outside APIs.
`;
}
