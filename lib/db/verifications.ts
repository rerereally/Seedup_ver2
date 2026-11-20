import { createAdminClient } from '../supabase/admin';
import { supervisorProject } from './supervisor-projects';
import type { Verification } from '../supervisor/types';
import type { UnseenFile } from '../verifier/github';

export type VerificationRecord = Verification & { unseen: UnseenFile[] };
export type VerificationScope = Pick<Verification, 'userId' | 'projectKey' | 'featureId' | 'repo' | 'sha'>;
export type VerificationStore = {
  authorize: (scope: VerificationScope) => Promise<void>;
  find: (scope: VerificationScope) => Promise<VerificationRecord | null>;
  claim: (row: VerificationRecord) => Promise<VerificationRecord>;
  save: (row: VerificationRecord) => Promise<void>;
  get: (userId: string, id: string) => Promise<VerificationRecord | null>;
  consume: (userId: string) => Promise<boolean>;
  refund: (userId: string) => Promise<void>;
};

const COLUMNS = 'id,user_id,project_key,feature_id,repo,sha,status,findings,verdicts,drift,checks,model,input_tokens,output_tokens,cost_usd,token,created_at,finished_at,unseen';
type Row = {
  id: string; user_id: string; project_key: string; feature_id: string; repo: string; sha: string;
  status: Verification['status']; findings: Verification['findings']; verdicts: Verification['verdicts'];
  drift: Verification['drift']; checks: Verification['checks']; model: string | null;
  input_tokens: number; output_tokens: number; cost_usd: number; token: string | null;
  created_at: string; finished_at: string | null; unseen: UnseenFile[];
};
const fromRow = (r: Row): VerificationRecord => ({
  id: r.id, userId: r.user_id, projectKey: r.project_key, featureId: r.feature_id, repo: r.repo, sha: r.sha,
  status: r.status, findings: r.findings, verdicts: r.verdicts, drift: r.drift, checks: r.checks, model: r.model,
  inputTokens: r.input_tokens, outputTokens: r.output_tokens, costUsd: r.cost_usd, token: r.token,
  createdAt: r.created_at, finishedAt: r.finished_at, unseen: r.unseen,
});
const toRow = (r: VerificationRecord): Row => ({
  id: r.id, user_id: r.userId, project_key: r.projectKey, feature_id: r.featureId, repo: r.repo, sha: r.sha,
  status: r.status, findings: r.findings, verdicts: r.verdicts, drift: r.drift, checks: r.checks, model: r.model,
  input_tokens: r.inputTokens, output_tokens: r.outputTokens, cost_usd: r.costUsd, token: r.token,
  created_at: r.createdAt, finished_at: r.finishedAt, unseen: r.unseen,
});

/** Service-role queries stay here; every lookup and write is scoped to the authenticated caller. */
export function verificationStore(): VerificationStore {
  const db = createAdminClient();
  if (!db) throw new Error('Verification database unavailable');
  const find: VerificationStore['find'] = async (scope) => {
    const { data, error } = await db.from('verifications').select(COLUMNS)
      .eq('user_id', scope.userId).eq('project_key', scope.projectKey).eq('feature_id', scope.featureId)
      .eq('repo', scope.repo).eq('sha', scope.sha).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  };
  // Keep the reservation date so a request crossing KST midnight refunds the day it actually consumed.
  const dates = new Map<string, string>();
  return {
    async authorize(scope) {
      const project = await supervisorProject(db, scope.userId, scope.projectKey);
      const connected = project?.repo?.replace(/^https:\/\/github\.com\//i, '').replace(/\.git\/?$/, '').replace(/\/$/, '').toLowerCase();
      if (!project || connected !== scope.repo.toLowerCase()) throw new Error('Project repository is not connected');
    },
    find,
    async claim(row) {
      const { error } = await db.from('verifications').insert(toRow(row));
      if (!error) return row;
      if (error.code === '23505') {
        const existing = await find(row);
        if (existing) return existing;
      }
      throw error;
    },
    async save(row) {
      const { data, error } = await db.from('verifications').update(toRow(row)).eq('id', row.id).eq('user_id', row.userId).select('id').single();
      if (error || !data) throw error ?? new Error('Verification was not saved');
    },
    async get(userId, id) {
      const { data, error } = await db.from('verifications').select(COLUMNS).eq('user_id', userId).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
    async consume(userId) {
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const { data, error } = await db.rpc('consume_ai_usage_for', { p_user: userId, p_feature: 'verification', p_daily_limit: 5 });
      // Paid verification fails closed; never use the racy read/write fallback.
      if (error) throw new Error('Verification usage count unavailable');
      if (data === true) dates.set(userId, day);
      return data === true;
    },
    async refund(userId) {
      const day = dates.get(userId);
      if (!day) return;
      for (let attempt = 0; attempt < 3; attempt++) {
        const query = () => db.from('ai_usage').select('count').eq('user_id', userId).eq('feature', 'verification').eq('usage_date', day);
        const { data, error } = await query().maybeSingle();
        if (error) throw new Error('Verification refund read failed');
        const count = Number(data?.count ?? 0);
        if (count <= 0) return;
        const { data: updated, error: updateError } = await db.from('ai_usage').update({ count: count - 1 })
          .eq('user_id', userId).eq('feature', 'verification').eq('usage_date', day).eq('count', count).select('count').maybeSingle();
        if (updateError) throw new Error('Verification refund failed');
        if (updated) return;
      }
      throw new Error('Verification refund conflicted');
    },
  };
}
