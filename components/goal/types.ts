// shortcut: A1 types.ts 머지 후 import로 교체 (docs/supervisor-plan.md 4절을 글자 그대로 옮김)
export type ProjectKey = string; // '<slug>' | `prd:${string}`
export type Track = 'personal' | 'launch';

export type SuccessCriterion = { id: string; text: string; measure: string; status: 'open' | 'partial' | 'met' };
export type ProjectGoal = {
  projectKey: ProjectKey; version: number; track: Track;
  statement: string; criteria: SuccessCriterion[]; inScope: string[]; outOfScope: string[];
  lockedAt: string; changeReason: string | null;
};
