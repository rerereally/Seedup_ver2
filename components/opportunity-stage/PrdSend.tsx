'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { featureIssue, githubIssueCommands, githubRepo, issuesCsv, issueUrl } from '@/lib/opportunities/issues';
import { slackPrdSummary } from '@/lib/opportunities/prd-share';
import type { Spec, SpecInput } from '@/lib/opportunities/spec';
import { downloadText } from './download';

const REPO_KEY = 'seedup:issue-repo:v1';

export function NotionImportHint() {
  const t = translator(useLang());
  return <p className="px-2 text-xs leading-5 text-muted">{t('Notion에서 설정 → 가져오기 → 텍스트 및 Markdown으로 PRD.md를 가져오세요.', 'In Notion, use Settings → Import → Text & Markdown to import PRD.md.')}</p>;
}

export default function PrdSend({ title, summary, p0Features, sharePath, prd }: {
  title: string;
  summary: string;
  p0Features: string[];
  sharePath?: string;
  prd?: { input: SpecInput; spec: Spec };
}) {
  const lang = useLang();
  const t = translator(lang);
  const [repo, setRepo] = useState<string | null>(null);
  const [githubLabels, setGithubLabels] = useState(false);
  const [featureId, setFeatureId] = useState('');
  const [message, setMessage] = useState('');
  const features = prd?.spec.features ?? [];
  const selected = features.find((feature) => feature.id === featureId) ?? features[0];
  const repository = githubRepo(repo ?? '');
  const shareUrl = () => sharePath ? new URL(sharePath, window.location.origin).href : undefined;
  const makeIssues = () => {
    if (!prd) return [];
    const url = shareUrl();
    return features.map((feature) => featureIssue(prd.input, prd.spec, feature, lang, url));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(t('복사했습니다.', 'Copied.'));
    } catch {
      setMessage(t('복사하지 못했습니다. 클립보드 권한을 확인해 주세요.', 'Could not copy. Check clipboard permission.'));
    }
  };

  const rememberRepo = () => {
    if (!repository) return;
    try { localStorage.setItem(REPO_KEY, repository); } catch { /* Storage is unavailable. */ }
  };

  const openIssue = (target: 'github' | 'linear') => {
    if (!selected || !prd) return;
    const issue = featureIssue(prd.input, prd.spec, selected, lang, shareUrl());
    const url = issueUrl(issue, target, lang, repository ?? undefined, githubLabels);
    if (url) {
      if (target === 'github') rememberRepo();
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setMessage(t('제목이나 공유 링크가 너무 깁니다. CSV로 받아주세요.', 'The title or share link is too long. Download the CSV.'));
    }
  };

  return (
    <details>
      <summary className="btn-quiet h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden" onClick={() => {
        if (repo !== null || !features.length) return;
        try { setRepo(githubRepo(localStorage.getItem(REPO_KEY) ?? '') ?? ''); } catch { setRepo(''); }
      }}>{t('보내기', 'Send')}</summary>
      <div className="absolute inset-x-0 z-30 mt-2 grid max-h-[55dvh] gap-3 overflow-y-auto rounded-xl border border-outline-soft bg-white p-3 shadow-lg sm:left-auto sm:w-96 sm:max-w-full">
        {selected && (
          <>
            <label className="grid min-w-0 gap-1 text-sm">
              {t('이슈로 만들 기능', 'Feature to turn into an issue')}
              <select className="w-full rounded-lg border border-field bg-white p-2" value={selected.id} onChange={(event) => setFeatureId(event.target.value)}>
                {features.map((feature) => <option key={feature.id} value={feature.id}>{feature.id} {feature.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              {t('GitHub 저장소', 'GitHub repository')}
              <input className="min-w-0 rounded-lg border border-field px-2 py-1.5" value={repo ?? ''} placeholder="owner/repo" maxLength={140} autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(repo && !repository)} onChange={(event) => setRepo(event.target.value)} onBlur={rememberRepo} />
            </label>
            {repo && !repository && <p className="text-xs text-muted">{t('owner/repo 형식으로 적어주세요.', 'Enter a repository as owner/repo.')}</p>}
            {repository && (
              <label className="flex items-start gap-2 text-xs leading-5 text-muted">
                <input className="mt-1" type="checkbox" checked={githubLabels} onChange={(event) => setGithubLabels(event.target.checked)} />
                {t('GitHub에 기존 P0/P1/P2 라벨 붙이기 (라벨 권한 필요)', 'Apply existing P0/P1/P2 labels on GitHub (requires label permission)')}
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-quiet" disabled={!repository} onClick={() => openIssue('github')}>{t('GitHub 이슈로', 'Open GitHub issue')}</button>
              <button type="button" className="btn-quiet" onClick={() => openIssue('linear')}>{t('Linear 이슈로', 'Open Linear issue')}</button>
              <button type="button" className="btn-quiet" disabled={!repository} onClick={() => {
                if (!repository) return;
                rememberRepo();
                const commands = githubIssueCommands(repository, makeIssues());
                if (commands) void copy(commands);
              }}>{t('모든 기능의 gh 명령 복사', 'Copy gh commands for all features')}</button>
            </div>
            <div className="grid gap-2 border-t border-outline-soft pt-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-quiet" onClick={() => downloadText('seedup-jira.csv', issuesCsv(makeIssues(), 'jira'), 'text/csv;charset=utf-8')}>{t('Jira CSV 받기', 'Download Jira CSV')}</button>
                <button type="button" className="btn-quiet" onClick={() => downloadText('seedup-linear.csv', issuesCsv(makeIssues(), 'linear'), 'text/csv;charset=utf-8')}>{t('Linear CSV 받기', 'Download Linear CSV')}</button>
              </div>
              <p className="text-xs leading-5 text-muted">{t('Jira의 외부 시스템 가져오기에서 CSV를 고르고, 우선순위를 Jira 값에 연결하세요.', 'Choose CSV in Jira’s External System Import and map priorities to your Jira values.')}</p>
              <p className="text-xs leading-5 text-muted">{t('Linear의 가져오기/내보내기 → CLI import에서 Linear CSV를 고르세요.', 'In Linear’s Import/Export → CLI import, choose the Linear CSV option.')}</p>
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-quiet" onClick={() => void copy(slackPrdSummary(title, summary, p0Features, shareUrl(), lang))}>{t('Slack에 붙일 요약 복사', 'Copy summary for Slack')}</button>
          {!sharePath && (prd
            ? <Link href="/scrap" className="text-xs text-seed underline underline-offset-4">{t('북마크에서 공유 링크 켜기', 'Enable a share link in Bookmarks')}</Link>
            : <p className="text-xs text-muted">{t('이 북마크에서 공유 링크를 켤 수 있습니다.', 'You can enable sharing on this bookmark.')}</p>)}
        </div>
        <p role="status" className="text-xs text-muted empty:hidden">{message}</p>
      </div>
    </details>
  );
}
