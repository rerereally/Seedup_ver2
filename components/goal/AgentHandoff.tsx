'use client';

import { useState } from 'react';
import Link from 'next/link';
import McpConnect from '@/components/McpConnect';
import AgentPackDownload from '@/components/AgentPackDownload';
import { useLang } from '@/components/LangProvider';
import { translator, type Lang } from '@/lib/i18n';
import { renderAgentBrief, type ExportFormat, type Spec, type SpecInput } from '@/lib/opportunities/spec';
import type { ProjectGoal } from '@/lib/supervisor/types';
import { downloadText } from '@/components/opportunity-stage/download';

export const supervisorHref = (projectKey: string) => `/supervisor/${encodeURIComponent(projectKey)}`;

export function agentStartPrompt(projectKey: string, lang: Lang) {
  const args = JSON.stringify({ project: projectKey });
  // Server verification (verify_feature) reads the connected repo, so the agent must connect one before its first check.
  const repoArgs = JSON.stringify({ project: projectKey, repo: 'owner/repo' });
  return translator(lang)(
    `Seedup 프로젝트 ${projectKey}를 이어서 진행해. resume_project ${args}로 잠긴 목표와 사람이 먼저 할 일을 확인하고, 연결된 저장소가 없으면 공개 GitHub 저장소를 만들거나 고른 뒤 connect_repo ${repoArgs}로 연결해. 그다음 get_next_task ${args}로 다음 기능 하나를 받아 시작해. 목표나 범위를 바꾸는 결정은 먼저 나에게 물어봐.`,
    `Continue Seedup project ${projectKey}. Use resume_project ${args} to check the locked goal and the things the person must do first. If no repository is connected, create or pick a public GitHub repository and connect it with connect_repo ${repoArgs}. Then use get_next_task ${args} to pick up one next feature and start. Ask me before making decisions that change the goal or scope.`,
  );
}

export async function loadProjectGoal(projectKey: string): Promise<ProjectGoal | null> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectKey)}/goal`, { cache: 'no-store' });
    if (!response.ok) return null;
    const json = await response.json();
    const goal = json?.goal ?? json;
    return typeof goal?.statement === 'string' ? goal as ProjectGoal : null;
  } catch {
    return null;
  }
}

export function renderProjectBrief(input: SpecInput, spec: Spec, format: ExportFormat, projectKey?: string, goal?: ProjectGoal | null) {
  return renderAgentBrief(input, spec, format, projectKey, { goal });
}

export default function AgentHandoff({ projectKey, input, spec }: { projectKey: string; input: SpecInput; spec: Spec }) {
  const lang = useLang();
  const t = translator(lang);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const prompt = agentStartPrompt(projectKey, lang);

  async function copyStart() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage(t('시작 문장을 복사했습니다.', 'Copied the start prompt.'));
    } catch {
      setMessage(t('아래 시작 문장을 선택해 직접 복사하세요.', 'Select and copy the start prompt below.'));
    }
  }

  async function downloadAgents() {
    setBusy(true);
    const goal = await loadProjectGoal(projectKey);
    if (goal) {
      downloadText('AGENTS.md', renderProjectBrief(input, spec, 'agents', projectKey, goal));
      setMessage(t('AGENTS.md 내려받기 시작', 'Downloading AGENTS.md'));
    } else {
      setMessage(t('잠긴 목표를 읽지 못했습니다. 목표가 저장됐는지 확인하고 다시 받아 주세요.', 'Could not read the locked goal. Check that it was saved and try again.'));
    }
    setBusy(false);
  }

  return <section aria-labelledby="agent-handoff-title" className="mb-8 min-w-0 space-y-7 border-b border-outline-soft pb-8">
    <div className="min-w-0">
      <h2 id="agent-handoff-title" className="text-xl font-semibold text-ink">{t('에이전트', 'Agent')}</h2>
      <p className="mt-2 break-all font-mono text-[13px] text-muted">{projectKey}</p>
      <Link href={supervisorHref(projectKey)} className="link-seed mt-2 inline-flex min-h-11 items-center">{t('이 프로젝트 감독관 열기', 'Open this project in supervisor')}</Link>
      <div className="mt-3"><button type="button" className="btn min-h-11 max-w-full px-5" onClick={() => void copyStart()}>{t('시작 문장 복사', 'Copy the start prompt')}</button></div>
      <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-tertiary [overflow-wrap:anywhere]">{prompt}</p>
      <p role="status" className="mt-2 text-[13px] text-muted [overflow-wrap:anywhere]">{message}</p>
    </div>
    <details className="min-w-0">
      <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-semibold text-ink">{t('MCP 연결', 'Connect MCP')}</summary>
      <p className="mb-4 text-[13px] leading-6 text-muted">{t('이미 연결했다면 이 단계는 건너뛰세요.', 'If already connected, skip this step.')}</p>
      <McpConnect siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com'} connected={false} lastUsed={null} />
    </details>
    <div className="min-w-0">
      <h3 className="text-[15px] font-semibold text-ink">{t('저장소에 넣기', 'Add to your repository')}</h3>
      <button type="button" className="btn-quiet mt-3 min-h-11 max-w-full" disabled={busy} onClick={() => void downloadAgents()}>{busy ? t('불러오는 중', 'Loading') : t('잠긴 목표가 담긴 AGENTS.md 받기', 'Download AGENTS.md with the locked goal')}</button>
      <p className="mt-3 text-[13px] leading-6 text-muted">{t('Codex 훅은 사용자가 /hooks에서 신뢰해야 실행됩니다.', 'Codex hooks run only after you trust them in /hooks.')}</p>
    </div>
    <AgentPackDownload key={projectKey} projects={[{ key: projectKey, title: input.title }]} />
  </section>;
}
