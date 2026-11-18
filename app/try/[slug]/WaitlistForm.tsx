'use client';

import { useState } from 'react';

/** Email waitlist with explicit consent; the address goes only to the person who made this page. */
export default function WaitlistForm({ slug }: { slug: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [message, setMessage] = useState('');

  if (state === 'done') return <p role="status" className="rounded-xl bg-seed-soft px-5 py-4 text-[15px] font-semibold text-seed">신청했습니다. 출시되면 알려 드릴게요.</p>;
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setState('sending');
        setMessage('');
        const response = await fetch(`/api/ideas/pages/${slug}/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), consent: data.get('consent') === 'on', website: data.get('website') }) }).catch(() => null);
        const json = response ? await response.json().catch(() => ({})) : {};
        if (response?.ok) setState('done');
        else {
          setState('idle');
          setMessage(json.error ?? '신청하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
        }
      }}
    >
      <label htmlFor="waitlist-email" className="text-[15px] font-semibold text-ink">출시되면 알림 받기</label>
      <div className="flex flex-wrap gap-2">
        <input id="waitlist-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-12 min-w-0 flex-1 basis-[16rem] rounded-xl border border-field bg-white px-4 text-[15px]" />
        <button type="submit" disabled={state === 'sending'} className="btn h-12 whitespace-nowrap px-6">{state === 'sending' ? '보내는 중' : '신청하기'}</button>
      </div>
      {/* Hidden from people; bots that fill every field are ignored. */}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex gap-2 text-[13px] leading-5 text-muted">
        <input name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-seed" />
        <span>이 이메일은 이 페이지를 만든 사람에게만 전달되고, 출시 알림에만 쓰입니다. 언제든 그 사람에게 삭제를 요청할 수 있습니다.</span>
      </label>
      {message && <p role="status" className="text-[13px] text-red-700">{message}</p>}
    </form>
  );
}
