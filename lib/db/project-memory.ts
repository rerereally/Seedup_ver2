// Shared project memory (supervisor_projects.sql, plan 3-11): decisions, session handoffs and project facts that any
// agent or person picks up again. The server is the source of truth; secrets are never stored, only env key names.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSupervisorProject } from '@/lib/db/supervisor-projects';
import type { Decision, Handoff, ProjectFact, ProjectKey } from '@/lib/db/supervisor-projects';

export type MemoryEntry =
  | { kind: 'decision'; body: Omit<Decision, 'id' | 'projectKey' | 'at'> }
  | { kind: 'handoff'; body: Omit<Handoff, 'projectKey' | 'at'> }
  | { kind: 'fact'; body: Omit<ProjectFact, 'projectKey' | 'at'> };

export type ProjectMemory = { decisions: Decision[]; handoffs: Handoff[]; facts: ProjectFact[] };

const ENV_NAME = /^[A-Z][A-Z0-9_]{0,99}$/;

/** Saves one memory entry. An env_name fact must be a bare key name, so a pasted `KEY=value` is refused, not stored. */
export async function addProjectMemory(service: SupabaseClient, userId: string, key: ProjectKey, entry: MemoryEntry) {
  if (entry.kind === 'fact' && entry.body.kind === 'env_name' && !ENV_NAME.test(entry.body.text)) {
    throw new Error('env_name facts hold a key name only, never a value');
  }
  await ensureSupervisorProject(service, userId, key);
  const { data, error } = await service.from('project_memory')
    .insert({ user_id: userId, project_key: key, kind: entry.kind, body: entry.body }).select('id,created_at').single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

/** The latest entries of each kind, newest first; responses carry a few, get_project_memory asks for more. */
export async function projectMemory(service: SupabaseClient, userId: string, key: ProjectKey, limit = 10): Promise<ProjectMemory> {
  const read = async (kind: MemoryEntry['kind']) => {
    const { data, error } = await service.from('project_memory').select('id,body,created_at')
      .eq('user_id', userId).eq('project_key', key).eq('kind', kind).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    // Only a decision carries its row id (Decision.id); the others are keyed by time.
    return (data as Array<{ id: string; body: Record<string, unknown>; created_at: string }>)
      .map((row) => ({ ...row.body, ...(kind === 'decision' ? { id: row.id } : {}), projectKey: key, at: row.created_at }));
  };
  const [decisions, handoffs, facts] = await Promise.all([read('decision'), read('handoff'), read('fact')]);
  return { decisions: decisions as Decision[], handoffs: handoffs as Handoff[], facts: facts as ProjectFact[] };
}
