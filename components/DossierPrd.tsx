'use client';

import { downloadText } from '@/components/opportunity-stage/download';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Read, copy, download or delete a saved evidence dossier from the 보관함 card. */
export default function DossierPrd({ id, title, markdown }: { id: string; title: string; markdown: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);

  const copy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setMessage('PRD를 복사했습니다.');
    } catch {
      setMessage('클립보드에 복사하지 못했습니다. 파일로 받아주세요.');
    }
  };

  const remove = async () => {
    if (!window.confirm(`'${title}'을(를) 보관함에서 지울까요? 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/opportunities/dossiers?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(String(response.status));
      router.refresh();
    } catch {
      setMessage('지우지 못했습니다. 잠시 후 다시 시도해주세요.');
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4">
      {markdown && (
        <details className="group rounded-xl border border-outline-soft bg-surface">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-ink">PRD 전문 보기</summary>
          {/* Plain text on purpose: the markdown came from the client, so it is never rendered as HTML. */}
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words border-t border-outline-soft px-4 py-3 font-sans text-[13px] leading-6 text-ink">{markdown}</pre>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {markdown && <button type="button" className="btn-quiet" onClick={copy}>마크다운 복사</button>}
        {markdown && <button type="button" className="btn-quiet" onClick={() => downloadText('PRD.md', markdown)}>PRD.md 받기</button>}
        <button type="button" className="btn-quiet" disabled={deleting} onClick={remove}>{deleting ? '지우는 중' : '삭제'}</button>
      </div>
      <p role="status" className="mt-2 text-[13px] text-muted">{message}</p>
    </div>
  );
}
