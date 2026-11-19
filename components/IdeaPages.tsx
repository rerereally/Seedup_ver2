'use client';

import { useEffect, useState } from 'react';

type Page = { id: string; slug: string; idea: string; headline: string; created_at: string; signups: number };

/** The owner's idea pages: make one, share its link, see how many joined, download the list, delete it. */
export default function IdeaPages({ initialIdea = '' }: { initialIdea?: string }) {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/ideas/pages').then((response) => (response.ok ? response.json() : { pages: [] })).then((json: { pages?: Page[] }) => setPages(json.pages ?? [])).catch(() => setPages([]));
  useEffect(() => {
    void load();
  }, []);

  const remove = async (page: Page) => {
    if (!window.confirm(`'${page.headline}' 페이지와 신청한 이메일 ${page.signups}개를 지울까요? 되돌릴 수 없습니다.`)) return;
    const response = await fetch(`/api/ideas/pages?id=${encodeURIComponent(page.id)}`, { method: 'DELETE' }).catch(() => null);
    setMessage(response?.ok ? '페이지와 신청 목록을 지웠습니다.' : '지우지 못했습니다.');
    if (response?.ok) void load();
  };

  return (
    <>
      <form
        className="mt-3 grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          setMessage('');
          const response = await fetch('/api/ideas/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea: data.get('idea'), headline: data.get('headline'), pitch: data.get('pitch') }) }).catch(() => null);
          const json = response ? await response.json().catch(() => ({})) : {};
          setBusy(false);
          if (response?.ok) {
            form.reset();
            setMessage(`페이지를 만들었습니다: ${window.location.origin}${json.path}`);
            void load();
          } else setMessage(json.error ?? '만들지 못했습니다.');
        }}
      >
        <input name="idea" required minLength={4} maxLength={300} defaultValue={initialIdea} placeholder="아이디어 한 줄" className="h-11 rounded-lg border border-field bg-white px-3 text-[14px]" />
        <input name="headline" maxLength={120} placeholder="페이지 제목 (비우면 아이디어 그대로)" className="h-11 rounded-lg border border-field bg-white px-3 text-[14px]" />
        <textarea name="pitch" maxLength={600} rows={3} placeholder="누구의 어떤 문제를 어떻게 푸는지 두세 문장" className="rounded-lg border border-field bg-white px-3 py-2 text-[14px]" />
        <button type="submit" disabled={busy} className="btn-quiet h-11 justify-self-start">소개 페이지 만들기</button>
      </form>
      {pages && pages.length > 0 && (
        <ul className="rows mt-4">
          {pages.map((page) => (
            <li key={page.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm">
              <a href={`/try/${page.slug}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold text-ink underline-offset-4 hover:underline">{page.headline}</a>
              <span className="text-muted">신청 {page.signups}명</span>
              {page.signups > 0 && <a href={`/api/ideas/pages/${page.slug}/csv`} className="text-seed underline-offset-4 hover:underline">명단 받기</a>}
              <button type="button" className="text-muted hover:text-red-700" onClick={() => void remove(page)}>삭제</button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-2 text-[13px] text-muted">{message}</p>
    </>
  );
}
