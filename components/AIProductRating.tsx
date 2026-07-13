'use client';

import { Loader2, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type RatingUpdate = { productId: string; average: number; ratingCount: number; userRating: number };
const RATING_EVENT = 'seedup:ai-product-rating';

function toDisplayRating(score: number | null, count: number | null) {
  const raw = Number(score ?? 0);
  if (!raw) return 0;
  return count && count > 0 ? Math.max(0, Math.min(5, raw)) : Math.max(0, Math.min(5, raw > 10 ? raw / 20 : raw / 2));
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)}점`}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < rounded ? 'fill-ink text-ink' : 'text-muted'}`} />)}</div>;
}

export function ProductRatingSummary({ productId, score, ratingCount }: { productId: string; score: number | null; ratingCount: number | null }) {
  const [state, setState] = useState(() => ({ average: toDisplayRating(score, ratingCount), count: Number(ratingCount ?? 0) }));

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
      <div>
        <p className="text-xs font-bold uppercase text-muted">평균 평점</p>
        <div className="mt-2 flex items-center gap-3"><p className="text-3xl font-black text-ink">{state.count ? state.average.toFixed(1) : '-'}</p><Stars rating={state.average} /></div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase text-muted">평가 참여</p>
        <p className="mt-2 text-3xl font-black text-ink">{state.count}</p>
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

  if (!isLoggedIn) return <Link href="/login" className="inline-flex h-11 items-center border border-outline-soft bg-ink px-4 text-sm font-bold text-white">로그인하고 평점 남기기</Link>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={pendingRating !== null} onClick={() => void submitRating(rating)} aria-pressed={selectedRating === rating} className={`inline-flex h-10 items-center gap-1 border px-3 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-55 ${selectedRating === rating ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-white text-ink hover:border-ink'}`}><Star className={`h-4 w-4 ${selectedRating === rating ? 'fill-white' : ''}`} />{pendingRating === rating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : rating}</button>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">한 제품에는 한 번의 평점만 저장되며, 다시 누르면 내 평점이 변경됩니다.</p>
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
