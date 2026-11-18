'use client';

import { downloadText } from '@/components/opportunity-stage/download';
import { builtReply } from '@/lib/opportunities/outreach';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Read, copy, download or delete a saved evidence dossier from the 북마크 card. */
export default function DossierPrd({ id, title, markdown, shared: initiallyShared = false, built: initiallyBuilt = null, quotes = [] }: { id: string; title: string; markdown: string | null; shared?: boolean; built?: { url: string; note: string } | null; quotes?: Array<{ quote: string; url: string }> }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [shared, setShared] = useState(initiallyShared);
  const [sharing, setSharing] = useState(false);
  const sharePath = `/spec/${id}`;
  const [built, setBuilt] = useState(initiallyBuilt);
  const [savingBuilt, setSavingBuilt] = useState(false);

  // "I built this": the link goes public under the problem, and the people who described it get a reply to post by hand.
  const saveBuilt = async (next: { url: string; note: string } | null) => {
    setSavingBuilt(true);
    setMessage('');
    try {
      const response = await fetch('/api/opportunities/dossiers', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, built: next }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? '저장하지 못했습니다.');
      setBuilt(next);
      if (next) setShared(true);
      setMessage(next ? '만든 것을 붙였습니다. 공유 링크가 켜지고, 이 문제의 상세 화면에 보입니다.' : '만든 것을 뗐습니다.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '저장하지 못했습니다.');
    } finally {
      setSavingBuilt(false);
    }
  };

  const copyText = async (value: string, done: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(done);
    } catch {
      setMessage('클립보드에 복사하지 못했습니다. 직접 선택해 복사하세요.');
    }
  };

  const toggleShare = async () => {
    setSharing(true);
    setMessage('');
    try {
      const response = await fetch('/api/opportunities/dossiers', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, shared: !shared }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? '공유 설정을 바꾸지 못했습니다.');
      setShared(!shared);
      if (!shared) {
        const url = `${window.location.origin}${sharePath}`;
        await navigator.clipboard.writeText(url).catch(() => undefined);
        setMessage(`공유 링크를 켜고 복사했습니다: ${url}`);
      } else setMessage('공유 링크를 껐습니다. 이전 링크는 더 이상 열리지 않습니다.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '공유 설정을 바꾸지 못했습니다.');
    } finally {
      setSharing(false);
    }
  };

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
    if (!window.confirm(`'${title}'을(를) 북마크에서 지울까요? 되돌릴 수 없습니다.`)) return;
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
        <details className="group rounded-xl border border-outline-soft bg-surface-low">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-seed">PRD 전문 보기</summary>
          {/* Plain text on purpose: the markdown came from the client, so it is never rendered as HTML. */}
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words border-t border-outline-soft px-4 py-3 font-sans text-[13px] leading-6 text-ink">{markdown}</pre>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {markdown && <button type="button" className="btn-quiet" onClick={copy}>마크다운 복사</button>}
        {markdown && <button type="button" className="btn-quiet" onClick={() => downloadText('PRD.md', markdown)}>PRD.md 받기</button>}
        {markdown && <button type="button" className="btn-quiet" disabled={sharing} aria-pressed={shared} onClick={() => void toggleShare()}>{shared ? '공유 링크 끄기' : '공유 링크 만들기'}</button>}
        {markdown && shared && <a href={sharePath} target="_blank" rel="noopener noreferrer" className="btn-quiet">공유 화면 열기</a>}
        <button type="button" className="btn-quiet" disabled={deleting} onClick={remove}>{deleting ? '지우는 중' : '삭제'}</button>
      </div>
      {markdown && (
        <details className="mt-3 rounded-xl border border-outline-soft">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-seed">{built ? '만든 것과 원문 작성자에게 보낼 답글' : '이걸로 만들었어요'}</summary>
          <div className="border-t border-outline-soft px-4 py-3">
            {built ? (
              <>
                <p className="text-sm"><a href={built.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-seed underline-offset-4 hover:underline">{built.url}</a>{built.note && <span className="text-muted"> {built.note}</span>}</p>
                <p className="mt-3 text-[13px] leading-5 text-muted">이 문제를 말한 사람들의 글입니다. 자동으로 보내지 않습니다. 글에 직접 답글로 남기세요.</p>
                <ul className="mt-2 grid gap-2">
                  {quotes.map((row) => (
                    <li key={row.url} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-ink underline-offset-4 hover:underline">{row.quote}</a>
                      <button type="button" className="text-seed underline-offset-4 hover:underline" onClick={() => void copyText(builtReply(row.quote, built.url, built.note), '답글 초안을 복사했습니다. 원문 글에 직접 붙여 넣으세요.')}>답글 초안 복사</button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-quiet mt-3" disabled={savingBuilt} onClick={() => void saveBuilt(null)}>만든 것 떼기</button>
              </>
            ) : (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void saveBuilt({ url: String(data.get('url') ?? ''), note: String(data.get('note') ?? '') });
                }}
              >
                <p className="text-[13px] leading-5 text-muted">만든 서비스 주소를 붙이면 이 PRD의 공유 링크가 켜지고, 같은 문제의 상세 화면에 보입니다.</p>
                <input name="url" type="url" required placeholder="https://" className="h-10 rounded-lg border border-field bg-white px-3 text-[14px]" />
                <input name="note" type="text" maxLength={200} placeholder="한 줄 소개 (선택)" className="h-10 rounded-lg border border-field bg-white px-3 text-[14px]" />
                <button type="submit" className="btn-quiet justify-self-start" disabled={savingBuilt}>만든 것 붙이기</button>
              </form>
            )}
          </div>
        </details>
      )}
      <p role="status" className="mt-2 text-[13px] text-muted">{message}</p>
    </div>
  );
}
