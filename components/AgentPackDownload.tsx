'use client';

import { useState } from 'react';
import Link from 'next/link';
import { agentStartPrompt, supervisorHref } from '@/components/goal/prompt';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import type { BundleFile } from '@/lib/supervisor/hook-bundle';

export default function AgentPackDownload({
  projects,
  unavailable = false,
  showStartPrompt = false,
}: {
  projects: Array<{ key: string; title: string }>;
  unavailable?: boolean;
  showStartPrompt?: boolean;
}) {
  const lang = useLang();
  const t = translator(lang);
  const [key, setKey] = useState(projects[0]?.key ?? '');
  const [files, setFiles] = useState<BundleFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [promptMessage, setPromptMessage] = useState('');

  async function copyPrompt(project: { key: string; title: string }) {
    try {
      await navigator.clipboard.writeText(agentStartPrompt(project.key, lang));
      setPromptMessage(t(`${project.title} 시작 문장 복사됨`, `Copied start prompt for ${project.title}`));
    } catch {
      setPromptMessage(t('복사하지 못했습니다. 아래 시작 문장을 선택해 복사해 주세요.', 'Copy failed. Select and copy the start prompt below.'));
    }
  }

  async function preview() {
    setBusy(true);
    setFiles([]);
    setMessage('');
    try {
      const response = await fetch(`/api/supervisor/${encodeURIComponent(key)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const result = await response.json() as { files: BundleFile[] };
      setFiles(result.files);
      if (!result.files.length) setMessage(t('아직 잠긴 목표가 없습니다. 기획 탭에서 목표를 잠근 뒤 다시 받아 주세요.', 'No locked goal yet. Lock a goal in the planning tab, then load the pack again.'));
    } catch {
      setMessage(t('스타터 팩을 불러오지 못했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.', 'Could not load the starter pack. Check your sign-in and try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(file: BundleFile) {
    try {
      await navigator.clipboard.writeText(file.content);
      setMessage(t(`${file.path} 복사됨`, `Copied ${file.path}`));
    } catch {
      setMessage(t('복사하지 못했습니다. 미리보기에서 내용을 선택해 복사해 주세요.', 'Copy failed. Select and copy the text in the preview.'));
    }
  }

  function download(file: BundleFile) {
    const url = URL.createObjectURL(new Blob([file.content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = file.path.split('/').pop()!;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(t(`${file.path} 내려받기 시작`, `Downloading ${file.path}`));
  }

  return <section aria-labelledby="agent-pack-heading" className="min-w-0 border-t border-outline-soft pt-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="agent-pack-heading" className="text-xl font-semibold text-ink">{t('프로젝트 스타터 팩', 'Project starter pack')}</h2>
      <Link href="/supervisor" className="btn-quiet min-h-11">{t('감독관 열기', 'Open supervisor')}</Link>
    </div>
    <p className="mt-3 text-sm leading-6 text-tertiary">{t('잠긴 목표, 에이전트 훅, 커밋 전 로컬 검사(.seedup/audit.mjs)를 프로젝트에 넣습니다. MCP 연결은 위 설정을 그대로 사용합니다.', 'Add the locked goal, agent hooks, and the local pre-commit check (.seedup/audit.mjs) to your project. Use the MCP connection configured above.')}</p>
    {showStartPrompt && projects.length > 0 && (
      <div className="mt-6 min-w-0 border-t border-outline-soft pt-5">
        <h3 className="text-[15px] font-semibold text-ink">{t('프로젝트별 시작 문장', 'Start prompt per project')}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{t('에이전트 대화창에 그대로 붙여 넣으세요. 토큰이나 비밀값은 들어가지 않습니다.', 'Paste into your agent chat. No token or secret is included.')}</p>
        <p role="status" className="mt-2 text-sm text-seed [overflow-wrap:anywhere]">{promptMessage}</p>
        <ul className="rows mt-3">
          {projects.map((project) => {
            const prompt = agentStartPrompt(project.key, lang);
            return (
              <li key={project.key} className="min-w-0 py-4">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{project.title}</p>
                    <p className="mt-0.5 font-mono text-[13px] text-muted [overflow-wrap:anywhere]">{project.key}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={supervisorHref(project.key)} className="link-seed inline-flex min-h-11 items-center px-2 text-sm">{t('감독관', 'Supervisor')}</Link>
                    <button
                      type="button"
                      onClick={() => void copyPrompt(project)}
                      className="btn-quiet min-h-11"
                      aria-label={t(`${project.title} 시작 문장 복사`, `Copy start prompt for ${project.title}`)}
                    >
                      {t('시작 문장 복사', 'Copy start prompt')}
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-tertiary [overflow-wrap:anywhere]">{prompt}</p>
              </li>
            );
          })}
        </ul>
      </div>
    )}
    {projects.length ? <form className="mt-5 flex min-w-0 flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void preview(); }}>
      <div className="min-w-0 flex-1 basis-60">
        <label htmlFor="pack-project" className="block text-sm font-semibold text-ink">{t('프로젝트', 'Project')}</label>
        <select id="pack-project" value={key} disabled={busy} onChange={(event) => { setKey(event.target.value); setFiles([]); setMessage(''); }} className="mt-2 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-outline-soft bg-white px-3 text-sm text-ink">
          {projects.map((project) => <option key={project.key} value={project.key}>{project.title} ({project.key})</option>)}
        </select>
      </div>
      <button type="submit" disabled={busy} className="btn-quiet min-h-11 disabled:opacity-50">{busy ? t('불러오는 중', 'Loading') : t('파일 미리보기', 'Preview files')}</button>
    </form> : <p className="mt-5 text-sm text-muted">{unavailable
      ? t('프로젝트 목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', 'Could not load projects. Please reopen this page shortly.')
      : t('PRD를 저장하거나 MCP에서 프로젝트를 연결하면 스타터 팩을 받을 수 있습니다.', 'Save a PRD or connect a project through MCP to load its starter pack.')}</p>}
    <p role="status" className="mt-3 text-sm text-muted [overflow-wrap:anywhere]">{message}</p>
    {files.length > 0 && <>
      <p className="mt-3 text-sm leading-6 text-muted">{t('파일마다 표시된 경로에 저장하세요. .claude/settings.json은 기존 hooks에 합치세요. 묶음에는 커밋 전 로컬 검사(.seedup/pre-commit.sh · .seedup/audit.mjs, Node 필요)가 포함돼 있습니다. 저장소에 pre-commit 훅이 없다면 .seedup/pre-commit.sh를 .git/hooks/pre-commit으로 복사하고 실행 권한을 주세요(.seedup/goal.md 안내 참고).', 'Save each file at its displayed path. Merge .claude/settings.json into existing hooks. The bundle includes the local pre-commit check (.seedup/pre-commit.sh and .seedup/audit.mjs, Node required). If the repo has no pre-commit hook yet, copy .seedup/pre-commit.sh to .git/hooks/pre-commit and make it executable (see .seedup/goal.md).')}</p>
      <div className="mt-5 space-y-4">{files.map((file) => <article key={file.path} className="card min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h3 className="min-w-0 font-mono text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{file.path}</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy(file)} className="btn-quiet min-h-11" aria-label={t(`${file.path} 복사`, `Copy ${file.path}`)}>{t('복사', 'Copy')}</button>
            <button type="button" onClick={() => download(file)} className="btn-quiet min-h-11" aria-label={t(`${file.path} 내려받기`, `Download ${file.path}`)}>{t('내려받기', 'Download')}</button>
          </div>
        </div>
        <pre tabIndex={0} aria-label={t(`${file.path} 미리보기`, `${file.path} preview`)} className="mt-4 max-h-80 min-w-0 overflow-y-auto whitespace-pre-wrap break-all border-t border-outline-soft pt-4 font-mono text-[13px] leading-6 text-tertiary">{file.content}</pre>
      </article>)}</div>
    </>}
  </section>;
}
