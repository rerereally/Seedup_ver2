// Shared contract for the supervisor (docs/supervisor-plan.md section 4). Changing a shape here needs both owners' agreement.
// Stage 1 holds goal, project, shared memory, verification and drift types; recommendation, skill pack and usage types come with the deferred features.

export type ProjectKey = string; // '<slug>' | `prd:${string}`
export type Track = 'personal' | 'launch';

export type SuccessCriterion = { id: string; text: string; measure: string; status: 'open' | 'partial' | 'met' };
export type ProjectGoal = {
  projectKey: ProjectKey; version: number; track: Track;
  statement: string; criteria: SuccessCriterion[]; inScope: string[]; outOfScope: string[];
  lockedAt: string; changeReason: string | null;
};
export type DriftFinding = {
  kind: 'unlinked_commit' | 'out_of_spec' | 'non_goal' | 'touched_done';
  sha: string; files: string[]; featureIds: string[]; message: string;
};

export type AuditSeverity = 'blocker' | 'warning';
export type AuditCode = 'LIE_TODO' | 'LIE_MOCK' | 'LIE_EMPTY_CATCH' | 'LIE_SKIPPED_TEST' | 'LIE_EMPTY_IMPL'
  | 'SEC_SECRET_LEAK' | 'SEC_CLIENT_SECRET' | 'SEC_XSS' | 'SEC_SQLI' | 'SEC_NO_AUTH';
export type AuditFinding = { code: AuditCode; category: 'lie' | 'security'; severity: AuditSeverity; file: string; line: number; snippet: string; message: string; fixHint: string; allowed?: string };
export type DiffAuditResult = { passed: boolean; blockerCount: number; warningCount: number; findings: AuditFinding[]; scrubbedDiff: string; redactedCount: number; diffHash: string };

export type CodeCitation = { path: string; line: number; quote: string; verified: boolean };
export type CriterionVerdict = { criterion: string; verdict: 'met' | 'not_met' | 'unclear'; reason: string; citations: CodeCitation[] };
export type VerificationStatus = 'queued' | 'running' | 'passed' | 'failed' | 'blocked' | 'error';
/** Badge shown for a done feature: 🟢 supervisor_verified, 🔵 local_checked, ⚪ self_reported. */
export type VerificationLevel = 'supervisor_verified' | 'local_checked' | 'self_reported';
export type Verification = {
  id: string; userId: string; projectKey: ProjectKey; featureId: string; repo: string; sha: string;
  status: VerificationStatus; findings: AuditFinding[]; verdicts: CriterionVerdict[]; drift: DriftFinding[];
  checks: Array<{ name: string; conclusion: string | null }>;
  model: string | null; inputTokens: number; outputTokens: number; costUsd: number;
  token: string | null; createdAt: string; finishedAt: string | null;
};
export type VerificationTokenPayload = { userId: string; projectKey: ProjectKey; featureId: string; sha: string; exp: number };

export type HumanTask = { id: string; title: string; category: 'auth' | 'database' | 'payment' | 'api_key' | 'deploy' | 'decision'; envVars: string[]; estimatedMinutes: number; guideSteps: string[]; unblocksFeatureIds: string[]; mockContractHint: string; done: boolean };

export type Decision = {
  id: string; projectKey: ProjectKey; goalVersion: number; title: string; why: string; rejected: string[];
  author: { kind: 'person' | 'agent'; name: string }; approved: boolean | null; featureIds: string[]; criterionIds: string[]; at: string;
};
export type Handoff = { projectKey: ProjectKey; agent: string; doing: string; next: string; cautions: string[]; unverifiedShas: string[]; at: string };
export type ProjectFact = { projectKey: ProjectKey; kind: 'stack' | 'command' | 'env_name' | 'do_not_touch' | 'other'; text: string; author: string; at: string };
export type SupervisorProject = { userId: string; projectKey: ProjectKey; repo: string | null; track: Track; strict: boolean; goalVersion: number | null };
