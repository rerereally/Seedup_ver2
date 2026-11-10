'use client';

import { Loader2, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type RatingUpdate = { productId: string; average: number; ratingCount: number; userRating: number };
const RATING_EVENT = 'seedup:ai-product-rating';

function toDisplayRating(average: number | null, count: number | null) {
  if (!count || count < 1) return 0;
  return Math.max(0, Math.min(5, Number(average ?? 0)));
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)}점`}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < rounded ? 'fill-ink text-ink' : 'text-muted'}`} />)}</div>;
}

export function ProductRatingSummary({ productId, ratingAverage, ratingCount }: { productId: string; ratingAverage: number | null; ratingCount: number | null }) {
  const [state, setState] = useState(() => ({ average: toDisplayRating(ratingAverage, ratingCount), count: Number(ratingCount ?? 0) }));

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<RatingUpdate>).detail;
      if (detail?.productId === productId) setState({ average: detail.average, count: detail.ratingCount });
    };
    window.addEventListener(RATING_EVENT, update);
    return () => window.removeEventListener(RATING_EVENT, update);
  }, [productId]);

  return (
    <>
      <div className="px-5 py-4">
        <dt className="label">평균 평점</dt>
        <dd className="mt-1 flex items-center gap-2.5"><span className="num text-[28px] font-semibold leading-tight text-ink">{state.count ? state.average.toFixed(1) : '–'}</span>{state.count > 0 && <Stars rating={state.average} />}</dd>
      </div>
      <div className="border-l border-outline-soft px-5 py-4">
        <dt className="label">평가한 사람</dt>
        <dd className="num mt-1 text-[28px] font-semibold leading-tight text-ink">{state.count}</dd>
      </div>
    </>
  );
}

export function AIProductRatingControl({ productId, isLoggedIn }: { productId: string; isLoggedIn: boolean }) {
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [error, setError] = useState('');

  const submitRating = async (rating: number) => {
    if (pendingRating) return;
    setPendingRating(rating);
    setError('');
    try {
      const response = await fetch(`/api/ai-products/${productId}/rating`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating }),
      });
      const json = await response.json().catch(() => null) as RatingUpdate & { error?: string } | null;
      if (!response.ok || !json?.average && json?.average !== 0) throw new Error(json?.error ?? '평점을 저장하지 못했습니다.');
      setSelectedRating(rating);
      window.dispatchEvent(new CustomEvent<RatingUpdate>(RATING_EVENT, { detail: { productId, average: json.average, ratingCount: json.ratingCount, userRating: json.userRating } }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '평점을 저장하지 못했습니다.');
    } finally {
      setPendingRating(null);
    }
  };

  if (!isLoggedIn) return <Link href="/login" className="btn-quiet">로그인하고 평점 남기기</Link>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={pendingRating !== null} onClick={() => void submitRating(rating)} aria-pressed={selectedRating === rating} className={`num inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-55 ${selectedRating === rating ? 'border-ink bg-ink text-white' : 'border-outline-soft text-ink hover:border-outline-strong'}`}><Star className={`h-4 w-4 ${selectedRating === rating ? 'fill-white' : ''}`} />{pendingRating === rating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : rating}</button>)}
      </div>
      <p className="mt-3 text-[13px] leading-5 text-muted">한 제품에 평점은 하나만 남습니다. 다시 누르면 바뀝니다.</p>
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
