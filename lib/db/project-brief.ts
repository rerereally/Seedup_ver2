// What the web planning chat learned (the evidence verdict, competitors, the person's answers), saved into the project's
// memory the way validate_idea does for MCP. Agents read it with get_project_memory (resume_project shows decisions and handoffs only).
import type { SupabaseClient } from '@supabase/supabase-js';
import { userPrdById } from '@/lib/db/dossiers';
import { addProjectMemory, projectMemory } from '@/lib/db/project-memory';
import { resolveProjectKey } from '@/lib/db/supervisor-projects';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { publicEvidence } from '@/lib/opportunities/types';
import type { Evidence } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_ANSWERS = 8;
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Memory lines for one brief: the evidence verdict first, then competitors, then the person's answers. */
export function briefFacts(body: unknown, evidence: Evidence[]) {
  const input = (body ?? {}) as { competitors?: unknown; answers?: unknown };
  const competitors = (Array.isArray(input.competitors) ? input.competitors : []).map((name) => clip(name, 80)).filter(Boolean).slice(0, 8);
  const answers = (Array.isArray(input.answers) ? input.answers : []).slice(0, MAX_ANSWERS)
    .map((row) => ({ question: clip((row as { question?: unknown })?.question, 160), answer: clip((row as { answer?: unknown })?.answer, 400) }))
    .filter((row) => row.question && row.answer);
  // The verdict comes from the quotes saved with the PRD, not from the browser.
  const checked = publicEvidence(evidence);
  const sites = new Set(checked.map((row) => row.platform)).size;
  const passes = meetsEvidenceBar(checked.length, sites);
  return [
    `Evidence verdict: ${checked.length} verified quote${checked.length === 1 ? '' : 's'} from ${sites} site${sites === 1 ? '' : 's'}. ${passes
      ? 'Meets the 3-quotes-from-2-sites bar.'
      : 'Below the 3-quotes-from-2-sites bar, so the PRD is a hypothesis draft: confirm assumptions with the person before building on them.'}`,
    ...(competitors.length ? [`Direct competitors found in planning: ${competitors.join('; ')}`] : []),
    ...answers.map((row) => `Planning answer. ${row.question}: ${row.answer}`),
  ];
}

/**
 * Writes one brief into the memory of the person's own saved idea PRD (prd:<id>). Lines already there are skipped, so
 * locking the goal again repeats nothing. null when the project is not theirs, 'unavailable' without the service key.
 */
export async function saveProjectBrief(userId: string, rawKey: string, body: unknown, service: SupabaseClient | null = createAdminClient()) {
  if (!service) return 'unavailable' as const;
  const id = rawKey.match(/^prd:([0-9a-f-]{36})$/i)?.[1];
  const key = id ? await resolveProjectKey(service, userId, rawKey) : null;
  const row = key && id ? await userPrdById(service, userId, id) : null;
  if (!key || !row) return null;
  // The verdict comes from the quotes saved with the PRD, never from what the browser says.
  const facts = briefFacts(body, Array.isArray(row.evidence) ? (row.evidence as Evidence[]) : []);
  const known = new Set((await projectMemory(service, userId, key, 50)).facts.map((fact) => fact.text));
  const added = facts.filter((text) => !known.has(text));
  for (const text of added) await addProjectMemory(service, userId, key, { kind: 'fact', body: { kind: 'other', text, author: 'seedup' } });
  return { added: added.length };
}
