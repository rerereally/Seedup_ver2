'use client';

import AgentHandoff from '@/components/goal/AgentHandoff';
import GoalLock from '@/components/goal/GoalLock';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { renderSpecMarkdown, type Spec, type SpecInput } from '@/lib/opportunities/spec';

/** Minimal SpecInput for saving a repo reverse-spec PRD and rendering AGENTS.md handoff exports. */
export function repoSpecInput(login: string, repo: { name: string; description: string }, summary?: string): SpecInput {
  return {
    title: `${repo.name} 역기획`,
    problem: summary || repo.description || `${login}/${repo.name}`,
    gap: '',
    evidence: [],
    competitors: [],
  };
}

/**
 * Saves a generated reverse-spec PRD as a personal PRD (`prd:<id>`) and attempts to link the analyzed GitHub
 * repository to that supervisor project so the repo entry lands at the same GoalLock -> AgentHandoff exit.
 */
export async function saveRepoPrdProject(
  { login, repoName, input, spec }: { login: string; repoName: string; input: SpecInput; spec: Spec },
  fetcher: typeof fetch = fetch,
): Promise<{ projectKey: string | null; repoConnected: boolean }> {
  const markdown = renderSpecMarkdown(input, spec);
  const dossierRes = await fetcher('/api/opportunities/dossiers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: input.title, evidenceIds: [], prdMarkdown: markdown }),
  }).catch(() => null);
  if (!dossierRes?.ok) return { projectKey: null, repoConnected: false };
  const dossierJson = await dossierRes.json().catch(() => null) as { id?: unknown } | null;
  if (typeof dossierJson?.id !== 'string' || !dossierJson.id) return { projectKey: null, repoConnected: false };
  const projectKey = `prd:${dossierJson.id}`;
  const repoRes = await fetcher(`/api/projects/${encodeURIComponent(projectKey)}/repo`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo: `${login}/${repoName}` }),
  }).catch(() => null);
  return { projectKey, repoConnected: Boolean(repoRes?.ok) };
}

/**
 * Shared supervisor exit rendered below a repo reverse-spec PRD: GoalLock followed by AgentHandoff once locked.
 */
export function RepoGoalExit({
  login,
  repoName,
  input,
  spec,
  projectKey,
  goalLocked,
  repoConnected = false,
  onLocked,
}: {
  login: string;
  repoName: string;
  input: SpecInput;
  spec: Spec;
  projectKey: string | null;
  goalLocked: boolean;
  repoConnected?: boolean;
  onLocked?: (locked: boolean) => void;
}) {
  const t = translator(useLang());
  return (
    <div className="mt-8 min-w-0 space-y-6">
      {projectKey && (
        <p role="status" className="text-[13px] leading-5 text-muted [overflow-wrap:anywhere]">
          {repoConnected
            ? t(`개인 PRD(${projectKey})로 저장하고 저장소 ${login}/${repoName}을 연결했습니다.`, `Saved as personal PRD (${projectKey}) and connected ${login}/${repoName}.`)
            : t(`개인 PRD(${projectKey})로 저장했습니다. 아래에서 목표를 잠그면 에이전트 단계로 이어집니다.`, `Saved as personal PRD (${projectKey}). Lock the goal below to continue to the agent step.`)}
        </p>
      )}
      <GoalLock key={`${login}/${repoName}`} spec={spec} idea={input.title} projectKey={projectKey} onLocked={onLocked} />
      {goalLocked && projectKey && <AgentHandoff projectKey={projectKey} input={input} spec={spec} />}
    </div>
  );
}
