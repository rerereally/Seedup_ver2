'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

/**
 * The hand-off to a coding agent in one click: a prompt that makes Claude Code or Cursor pull this PRD through the
 * Seedup MCP server and build it feature by feature. Connecting the agent (a token) is a one-time step on /profile.
 */
export default function AgentStart({ slug, name, className = '' }: { slug: string; name: string; className?: string }) {
  const t = translator(useLang());
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const prompt = t(
    `Seedup MCP의 generate_verified_prd로 "${slug}"(${name}) PRD를 받아 AGENTS.md로 저장해 줘. 그다음 get_build_checklist를 보고 F-01부터 하나씩 만들고, 완료 기준을 통과하면 mark_feature_done으로 표시해 줘.`,
    `Use the Seedup MCP tool generate_verified_prd for "${slug}" (${name}) and save it as AGENTS.md. Then follow get_build_checklist, build F-01 first, one feature at a time, and call mark_feature_done when its done criteria pass.`,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <div id="agent" className={`scroll-mt-24 ${className}`}>
      <button type="button" onClick={() => void copy()} className="btn-quiet h-11 px-4">{copied === 'done' ? t('복사했습니다', 'Copied') : t('에이전트로 시작', 'Start with an agent')}</button>
      <p className="mt-1.5 text-[13px] leading-5 text-muted" aria-live="polite">
        {copied === 'failed'
          ? <>{t('복사하지 못했습니다. 아래 문장을 직접 복사하세요: ', 'Could not copy. Copy this yourself: ')}<span className="text-ink">{prompt}</span></>
          : <>{t('Claude Code·Cursor에 붙여 넣으면 이 PRD로 바로 만들기 시작합니다. 처음이면 ', 'Paste into Claude Code or Cursor to start building from this PRD. First time? ')}<Link href="/profile" className="text-seed underline-offset-4 hover:underline">{t('MCP 연동', 'connect your agent')}</Link>{t('부터.', ' first.')}</>}
      </p>
    </div>
  );
}
