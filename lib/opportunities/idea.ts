import { specInputFor } from './context';
import { findEvidence } from './data';
import { readLiveEvidence } from './live-evidence';
import type { SpecInput } from './spec';
import type { Evidence, Opportunity } from './types';

/** What the user typed in the idea workspace: the idea itself and their answers to the planning questions. */
export type IdeaBrief = { idea: string; answers: Array<{ question: string; answer: string }> };

const MAX_IDEA = 300;
const MAX_ANSWERS = 8;
const MAX_ANSWER = 400;
const MAX_EVIDENCE = 12;

const clip = (value: unknown, limit: number) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');

/** Request body -> brief, or null when the request is not an idea-mode one. Everything is clipped: it goes into a prompt. */
export function readBrief(value: unknown): IdeaBrief | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const idea = clip(record.idea, MAX_IDEA);
  if (idea.length < 4) return null;
  const answers = (Array.isArray(record.answers) ? record.answers : []).slice(0, MAX_ANSWERS).flatMap((row) => {
    const item = (row ?? {}) as Record<string, unknown>;
    const question = clip(item.question, 120);
    const answer = clip(item.answer, MAX_ANSWER);
    return question && answer ? [{ question, answer }] : [];
  });
  return { idea, answers };
}

/**
 * The PRD context for an idea. The user's own words describe the problem; quotes they kept add the developer
 * problems, gaps and rivals around it, and stay the only thing a requirement may cite as evidence.
 */
export function ideaSpecInput(opportunities: Opportunity[], brief: IdeaBrief, picked: Array<{ evidence: Evidence; slug: string }>, lang: 'ko' | 'en' = 'ko'): SpecInput {
  const related = picked.length ? specInputFor(opportunities, picked, '', lang) : null;
  const en = lang === 'en';
  const answers = brief.answers.map((row) => `- ${row.question}: ${row.answer}`).join('\n');
  return {
    title: brief.idea.length > 60 ? `${brief.idea.slice(0, 60)}…` : brief.idea,
    problem: [
      brief.idea,
      answers && `${en ? 'Planner answers' : '기획자 답변'}:\n${answers}`,
      related && `${en ? 'Developer problems behind the kept quotes' : '담은 원문이 말하는 개발자 문제'}:\n${related.problem}`,
    ].filter(Boolean).join('\n\n'),
    gap: related?.gap ?? '',
    evidence: picked.map((item) => item.evidence),
    competitors: related?.competitors ?? [],
  };
}

const MAX_NOTES = 1_000;
const MAX_OWN = 10;
const MAX_OWN_LENGTH = 400;

/**
 * Sentences the maker heard in interviews or wrote in notes, sent with an idea PRD. They are evidence of a weaker kind:
 * labeled as the maker's own, shown without a source link, and never counted toward the evidence bar.
 */
export function ownEvidence(value: unknown): Evidence[] {
  return (Array.isArray(value) ? value : []).flatMap((row) => (typeof row === 'string' && row.trim().length >= 8 ? [row.replace(/\s+/g, ' ').trim().slice(0, MAX_OWN_LENGTH)] : []))
    .slice(0, MAX_OWN)
    .map((quote, index) => ({ id: `own_${index + 1}`, platform: 'own' as const, quote, quoteKo: '', url: '', score: 0, postedAt: null }));
}

/** What the person making the PRD wants (direction, must-haves, what to leave out), typed before generating. */
export const readNotes = (body: Record<string, unknown> | null) => clip(body?.notes, MAX_NOTES);

/**
 * Adds the maker's own view to the PRD context. The model treats it like any other input: lines it supports but no
 * quote backs become hypotheses, so an opinion shapes the PRD without passing for evidence.
 */
export function withNotes(input: SpecInput, notes: string, lang: 'ko' | 'en' = 'ko'): SpecInput {
  return notes ? { ...input, problem: `${input.problem}\n\n${lang === 'en' ? "The maker's own view (not evidence)" : '만드는 사람의 의견 (근거 아님)'}:\n${notes}` } : input;
}

/** One reader for the PRD, revise and slots routes: an idea brief when one is sent, otherwise the classic quote list. */
export function inputFromBody(opportunities: Opportunity[], body: Record<string, unknown> | null, lang: 'ko' | 'en') {
  const evidenceIds = (Array.isArray(body?.evidenceIds) ? body.evidenceIds : []).filter((id): id is string => typeof id === 'string').slice(0, MAX_EVIDENCE);
  const brief = readBrief(body?.brief);
  // Quotes found on the web for this idea count only in idea mode, and only with this server's signature.
  const live = brief ? readLiveEvidence(body?.liveEvidence, MAX_EVIDENCE).map((evidence) => ({ evidence, slug: 'live' })) : [];
  const own = brief ? ownEvidence(body?.ownNotes).map((evidence) => ({ evidence, slug: 'own' })) : [];
  const picked = [...findEvidence(opportunities, evidenceIds), ...live].slice(0, MAX_EVIDENCE);
  // The maker's notes ride after the checked quotes and never push one of them out.
  picked.push(...own);
  const notes = readNotes(body);
  if (brief) return { input: withNotes(ideaSpecInput(opportunities, brief, picked, lang), notes, lang), picked, brief, notes };
  const input = specInputFor(opportunities, picked, clip(body?.title, 120), lang);
  return input ? { input: withNotes(input, notes, lang), picked, brief: null, notes } : null;
}
