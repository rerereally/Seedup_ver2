import { translator, type Lang } from '@/lib/i18n';

export const supervisorHref = (projectKey: string) => `/supervisor/${encodeURIComponent(projectKey)}`;

export function agentStartPrompt(projectKey: string, lang: Lang) {
  const args = JSON.stringify({ project: projectKey });
  return translator(lang)(
    `Seedup 프로젝트 ${projectKey}를 이어서 진행해. resume_project ${args}로 잠긴 목표와 사람이 먼저 할 일을 확인하고, get_next_task ${args}로 다음 기능 하나를 받아 시작해. 목표나 범위를 바꾸는 결정은 먼저 나에게 물어봐.`,
    `Continue Seedup project ${projectKey}. Use resume_project ${args} to check the locked goal and the things the person must do first, then get_next_task ${args} to pick up one next feature and start. Ask me before making decisions that change the goal or scope.`,
  );
}
