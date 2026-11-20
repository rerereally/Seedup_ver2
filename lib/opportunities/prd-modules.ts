import { translator, type Lang } from '../i18n';
import { isCutOffEvidenceQuote } from './quote-completeness';
import { isVerbatimQuote, normalizeForMatch } from './rules';
import { p0FeatureIds, SLOT_KEYS, slotIsOpen, slotLabels, withPrdReadiness } from './spec';
import type { ReadinessSlots, Spec } from './spec';
import type { WorkspaceQuestion } from './questions';
import type { Evidence } from './types';

export const PRD_MODULES = {
  api_tool: {
    label: ['API · 개발 도구', 'API and developer tools'],
    fields: { design: ['API 설계', 'API design'], rate_limits: ['요청 한도', 'Rate limits'], versions: ['버전 정책', 'Versioning policy'], sdk: ['SDK', 'SDK'] },
  },
  enterprise: {
    label: ['기업용', 'Enterprise'],
    fields: { permissions: ['권한', 'Permissions'], compliance: ['보안 · 준수 요건', 'Security and compliance'], audit: ['감사 기록', 'Audit logs'], integrations: ['연동', 'Integrations'] },
  },
  consumer: {
    label: ['소비자 앱', 'Consumer app'],
    fields: { onboarding: ['첫 사용 안내', 'Onboarding'], retention: ['재방문', 'Retention'], store_policy: ['스토어 정책', 'App store policies'] },
  },
  data_ai: {
    label: ['데이터 · AI', 'Data and AI'],
    fields: { sources: ['데이터 출처와 라이선스', 'Data sources and licensing'], cost: ['모델 비용', 'Model costs'], quality: ['품질 측정', 'Quality measurement'] },
  },
  external_api: {
    label: ['외부 API 의존', 'External API dependencies'],
    fields: { pricing: ['외부 API 가격', 'API pricing'], terms: ['외부 API 약관', 'API terms'], shutdown: ['외부 API 종료 위험', 'API shutdown risk'] },
  },
} as const;

export type PrdModuleId = keyof typeof PRD_MODULES;
export type PrdFinding = { text: string; evidence?: number; answered?: true };
export type PrdModule = { id: PrdModuleId; reason: string; fields: Record<string, PrdFinding> };

export const MODULE_HEADING = ['추가 모듈', 'PRD modules'] as const;
const OPEN = ['확인 필요', 'Open question'] as const;
const HYPOTHESIS = ['가설', 'Hypothesis'] as const;
export const moduleFields = (id: PrdModuleId) => Object.entries(PRD_MODULES[id].fields);
export const moduleId = (id: string): id is PrdModuleId => Object.hasOwn(PRD_MODULES, id);

export const prdLine = (value: unknown, limit = 400) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : '';
const CITATION = /\s*\[E-(\d+)\]$/i;
const withoutRefs = (value: string) => value.replace(/[[(]\s*[EH]\s*-?\s*\d+(?:\s*[,，/]\s*[EH]?\s*-?\s*\d+)*\s*[\])]/gi, '').trim();
const pending = /^(?:(?:확인 필요|open question)\s*(?::|$)|\(?\s*(?:미정|없음|tbd|unknown|not defined)\s*\)?$)/i;
const ANSWER_MARKER = /^(?:기획자 답변|Planner answer)\s*:\s*/i;
const trimProposedAnswer = (text: unknown, limit = 240) => withoutRefs(prdLine(text, limit));
export const isSlotFinding = (line: string) => CITATION.test(line) || ANSWER_MARKER.test(line);

/** Only a copy of an entire verified source quote can fill an item with an E-number. */
export function groundedFinding(value: unknown, sources: readonly Evidence[]): PrdFinding | undefined {
  const row = value as Partial<PrdFinding> | null;
  const index = row?.evidence;
  const source = typeof index === 'number' && Number.isInteger(index) ? sources[index - 1] : undefined;
  const text = prdLine(row?.text);
  if (!source || source.platform === 'own' || !source.url || isCutOffEvidenceQuote(source.quote) || pending.test(text) || withoutRefs(text) !== text) return;
  if (!isVerbatimQuote(text, source.quote) || normalizeForMatch(text) !== normalizeForMatch(source.quote)) return;
  return { text: prdLine(source.quote), evidence: index };
}

export function findingFromLine(line: string) {
  const citation = CITATION.exec(line);
  return citation ? { text: line.slice(0, citation.index), evidence: Number(citation[1]) } : { text: line };
}

export function findingLine(finding: PrdFinding) {
  return `${finding.text}${finding.evidence ? ` [E-${finding.evidence}]` : ''}`;
}

export function normalizeFinding(value: unknown, sources: readonly Evidence[]): PrdFinding | undefined {
  const row = value as Partial<PrdFinding> | null;
  if (row?.evidence !== undefined) return groundedFinding(row, sources);
  const text = withoutRefs(prdLine(row?.text));
  return text && !pending.test(text) ? { text, ...(row?.answered === true ? { answered: true as const } : {}) } : undefined;
}

export function normalizeModules(value: unknown, sources: readonly Evidence[] = [], keepAnswers = true) {
  if (!Array.isArray(value)) return;
  const modules: PrdModule[] = [];
  for (const row of value.slice(0, 10)) {
    if (typeof row?.id !== 'string' || !moduleId(row.id) || modules.some(({ id }) => id === row.id)) continue;
    const id = row.id;
    const reason = withoutRefs(prdLine(row.reason, 180));
    if (!reason) continue;
    const fields = Object.fromEntries(moduleFields(id).flatMap(([key]) => {
      const item = row.fields?.[key];
      const finding = normalizeFinding({ text: item?.text, evidence: item?.evidence, answered: keepAnswers && item?.answered }, sources) ?? normalizeFinding({ text: item?.text }, []);
      return finding ? [[key, finding]] : [];
    }));
    modules.push({ id, reason, fields });
    if (modules.length === 2) break;
  }
  return modules.length ? modules : undefined;
}

export function moduleEntries(spec: Spec, lang: Lang = 'ko') {
  const t = translator(lang);
  let hypothesis = Math.max(0, ...spec.hypotheses.map(({ id }) => Number(/^H-(\d+)$/.exec(id)?.[1]) || 0));
  return (spec.modules ?? []).map((module) => ({
    ...module,
    title: t(PRD_MODULES[module.id].label[0], PRD_MODULES[module.id].label[1]),
    entries: moduleFields(module.id).map(([key, labels]) => {
      const item = module.fields[key];
      const label = t(labels[0], labels[1]);
      const hypothesisId = `H-${String(++hypothesis).padStart(2, '0')}`;
      const id = item?.evidence ? `E-${item.evidence}` : hypothesisId;
      const status = item?.evidence ? t('원문', 'Source quote') : item?.answered ? t('기획자 답변', 'Planner answer') : item ? t(...HYPOTHESIS) : t(...OPEN);
      return { key, label, item, id, status };
    }),
  }));
}

export function renderPrdModules(spec: Spec, lang: Lang) {
  const t = translator(lang);
  const modules = moduleEntries(spec, lang);
  if (!modules.length) return '';
  return `## ${t(...MODULE_HEADING)}\n\n${modules.map(({ id, title, reason, entries }) => [
    `### ${title} (${id})`,
    ...(reason ? [`- ${t('선택 이유', 'Reason')}: ${reason}`] : []),
    ...entries.map(({ key, label, item, id, status }) =>
      `- **${label} (${key})**: ${item?.evidence ? findingLine(item) : `[${id}] ${status}${item ? `: ${item.text}` : ''}`}`),
  ].join('\n')).join('\n\n')}\n\n`;
}

export function parsePrdModules(lines: string[]) {
  const modules: PrdModule[] = [];
  let current: PrdModule | undefined;
  for (const line of lines) {
    const heading = /^#{3,6}\s+(.*)$/.exec(line);
    if (heading) {
      const id = /\(([a-z_]+)\)$/.exec(heading[1])?.[1] ?? heading[1].trim();
      current = moduleId(id) ? { id, reason: '', fields: {} } : undefined;
      if (current) modules.push(current);
      continue;
    }
    const item = /^\s*-\s+(.+?)[:：]\s*(.*)$/.exec(line);
    if (!current || !item) continue;
    const label = item[1].replace(/\*\*/g, '').trim();
    const key = /\(([a-z_]+)\)$/.exec(label)?.[1] ?? label;
    if (/^(?:선택 이유|reason)$/i.test(key)) current.reason = item[2];
    else if (Object.hasOwn(PRD_MODULES[current.id].fields, key)) {
      const text = item[2].replace(/^\[H-\d+\]\s*/, '').replace(/^(?:가설|hypothesis)\s*:\s*/i, '');
      current.fields[key] = ANSWER_MARKER.test(text) ? { text: text.replace(ANSWER_MARKER, ''), answered: true } : findingFromLine(text);
    }
  }
  return modules.length ? modules : undefined;
}

export const MODULE_WRITING_FORMAT = Object.entries(PRD_MODULES)
  .map(([id, { label, fields }]) => `${id} (${label[1]}): ${Object.entries(fields).map(([key, names]) => `${key} (${names[1]})`).join(', ')}`).join('\n');

export function moduleIssues(spec: Spec) {
  const t = translator(spec.lang ?? 'ko');
  return moduleEntries(spec, spec.lang).flatMap(({ title, entries }) => entries.flatMap(({ label, item }) => item ? [] : [
    t(`${title} 모듈의 ‘${label}’이 비어 있습니다.`, `The ${title} module is missing “${label}”.`),
  ]));
}

type Gap = { key: string; context: string; question: string; target:
  | { kind: 'slot'; id: string; slot: keyof ReadinessSlots }
  | { kind: 'module'; id: PrdModuleId; field: string }
  | { kind: 'hypothesis'; id: string }
};

export function prdGaps(spec: Spec): Gap[] {
  const lang = spec.lang ?? 'ko';
  const t = translator(lang);
  const p0 = p0FeatureIds(spec);
  const slots = (first: boolean) => spec.features.filter((feature) => p0.has(feature.id) === first && feature.slots).flatMap((feature): Gap[] =>
    SLOT_KEYS.flatMap((slot) => {
      if (!slotIsOpen(feature.slots?.[slot])) return [];
      const label = slotLabels(lang)[slot];
      return [{
        key: `${feature.id}:${slot}`, context: feature.detail,
        question: t(`‘${feature.title}’의 ${label}을 어떻게 정할까요?`, `What should we specify for ${label.toLowerCase()} in “${feature.title}”?`),
        target: { kind: 'slot', id: feature.id, slot },
      }];
    }));
  const modules = moduleEntries(spec, lang).flatMap((module) => module.entries.flatMap(({ key, label, item }): Gap[] =>
    item?.evidence || item?.answered ? [] : [{
      key: `${module.id}:${key}`, context: [module.reason, item?.text].filter(Boolean).join(' '),
      question: t(`‘${module.title}’의 ${label}을 어떻게 정할까요?`, `What should we specify for ${label.toLowerCase()} in “${module.title}”?`),
      target: { kind: 'module', id: module.id, field: key },
    }]));
  const hypotheses = spec.hypotheses.flatMap((row): Gap[] => row.followup ? [] : [{
    key: row.id, context: [row.title, row.detail, row.check].filter(Boolean).join(' '),
    question: t(`${row.id} 가설 ‘${row.title}’을 어떻게 확인할까요?`, `How should we check hypothesis ${row.id}, “${row.title}”?`),
    target: { kind: 'hypothesis', id: row.id },
  }]);
  return [...slots(true), ...modules, ...hypotheses, ...slots(false)];
}

function applyFindings(spec: Spec, gaps: Gap[], findings: Map<string, PrdFinding>) {
  const next = structuredClone(spec);
  const t = translator(spec.lang ?? 'ko');
  for (const { key, target } of gaps) {
    const finding = findings.get(key);
    if (!finding) continue;
    if (target.kind === 'slot') {
      const slots = next.features.find(({ id }) => id === target.id)?.slots;
      const line = finding.answered ? `${t('기획자 답변', 'Planner answer')}: ${finding.text}` : findingLine(finding);
      if (slots) slots[target.slot] = [...slots[target.slot].filter((line) => !slotIsOpen([line])), line].slice(-5);
    } else if (target.kind === 'module') {
      const section = next.modules?.find(({ id }) => id === target.id);
      if (section) section.fields[target.field] = finding;
    } else {
      const hypothesis = next.hypotheses.find(({ id }) => id === target.id);
      if (hypothesis) hypothesis.followup = finding;
    }
  }
  return next;
}

export function applyPrdResearch(spec: Spec, originalSources: readonly Evidence[], storedSources: readonly Evidence[], raw: unknown, newSourceLimit: number) {
  const ready = withPrdReadiness(spec);
  const gaps = prdGaps(ready);
  const keys = new Set(gaps.map(({ key }) => key));
  const sources = [...originalSources, ...storedSources];
  const output = (raw ?? {}) as { findings?: unknown[]; questions?: unknown[] };
  const findings = new Map<string, PrdFinding>();
  const added: Evidence[] = [];
  for (const item of (Array.isArray(output.findings) ? output.findings : []).slice(0, gaps.length) as Array<{ key?: string } & PrdFinding>) {
    if (!item || typeof item.key !== 'string' || !keys.has(item.key) || findings.has(item.key)) continue;
    const finding = groundedFinding(item, sources);
    if (!finding?.evidence) continue;
    if (finding.evidence > originalSources.length) {
      const source = sources[finding.evidence - 1];
      const known = added.findIndex(({ id }) => id === source.id);
      if (known < 0 && added.length >= newSourceLimit) continue;
      if (known < 0) added.push(source);
      finding.evidence = originalSources.length + (known < 0 ? added.length : known + 1);
    }
    findings.set(item.key, finding);
  }
  const remaining = gaps.filter(({ key }) => !findings.has(key));
  const proposed = Array.isArray(output.questions) ? output.questions.slice(0, 5) as Array<{ key?: string; question?: unknown; why?: unknown; options?: unknown }> : [];
  const questions = remaining.slice(0, 5).map(({ key, question }): WorkspaceQuestion => {
    const row = proposed.find((item) => item?.key === key);
    return {
      key, text: trimProposedAnswer(row?.question, 180) || question,
      hint: trimProposedAnswer(row?.why, 160),
      chips: [...new Set((Array.isArray(row?.options) ? row.options.slice(0, 4) : []).map((option) => trimProposedAnswer(option, 80)).filter(Boolean))],
    };
  });
  return { spec: applyFindings(ready, gaps, findings), added, filled: findings.size, remaining: remaining.length, questions };
}

export function answerPrdGaps(spec: Spec, raw: unknown) {
  const ready = withPrdReadiness(spec);
  const gaps = prdGaps(ready);
  const keys = new Set(gaps.slice(0, 5).map(({ key }) => key));
  const findings = new Map<string, PrdFinding>();
  for (const item of (Array.isArray(raw) ? raw.slice(0, 5) : [])) {
    if (typeof item?.key !== 'string' || !keys.has(item.key) || findings.has(item.key)) continue;
    const finding = normalizeFinding({ text: trimProposedAnswer(item.answer), answered: true }, []);
    if (finding) findings.set(item.key, finding);
  }
  return findings.size ? { spec: applyFindings(ready, gaps, findings), filled: findings.size } : null;
}
