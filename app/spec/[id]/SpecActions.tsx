'use client';

import { useState } from 'react';
import { downloadText } from '@/components/opportunity-stage/download';
import { NotionImportHint } from '@/components/opportunity-stage/PrdSend';

/** Copy the share link or take the PRD as a file. The saved dossier only holds markdown, so that is the file offered. */
export default function SpecActions({ markdown }: { markdown: string }) {
  const [message, setMessage] = useState('');
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('링크를 복사했습니다.');
    } catch {
      setMessage('복사하지 못했습니다. 주소창의 주소를 직접 복사하세요.');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" className="text-[13px] text-muted">{message}</span>
      <button type="button" className="btn-quiet" onClick={() => void copyLink()}>링크 복사</button>
      <button type="button" className="btn" onClick={() => downloadText('PRD.md', markdown)}>PRD.md 받기</button>
      <NotionImportHint />
    </div>
  );
}
