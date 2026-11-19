'use client';

import { Children, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const AUTO_MS = 6_000;

/**
 * The home banner: one read at a time, sliding sideways like a site banner. It is a native scroll-snap strip, so a
 * finger, a trackpad and the arrows all move it; it turns by itself every few seconds until the reader hovers, focuses
 * inside, or has asked for less motion.
 */
export default function ReadCarousel({ label, children }: { label: string; children: ReactNode }) {
  const slides = Children.toArray(children);
  const strip = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((index: number) => {
    const box = strip.current;
    if (!box) return;
    const next = (index + slides.length) % slides.length;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ left: next * box.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  }, [slides.length]);

  // The slide in view decides the dots, whatever moved the strip.
  useEffect(() => {
    const box = strip.current;
    if (!box) return;
    const onScroll = () => setCurrent(Math.round(box.scrollLeft / Math.max(1, box.clientWidth)));
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => go(current + 1), AUTO_MS);
    return () => window.clearInterval(timer);
  }, [paused, current, go, slides.length]);

  if (!slides.length) return null;
  const arrow = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-soft text-tertiary transition-colors hover:border-outline-strong hover:text-ink';
  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(current + 1);
        if (event.key === 'ArrowLeft') go(current - 1);
      }}
    >
      {slides.length > 1 && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <span className="num mr-1 text-[13px] text-muted" aria-live="polite">{current + 1} / {slides.length}</span>
          <button type="button" onClick={() => go(current - 1)} aria-label="이전 글" className={arrow}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" onClick={() => go(current + 1)} aria-label="다음 글" className={arrow}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      )}
      <div ref={strip} className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border border-outline-soft bg-surface-low [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide, index) => (
          <div key={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${slides.length}`} aria-hidden={index !== current} inert={index !== current} className="w-full shrink-0 snap-start p-6 sm:p-8">
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {slides.map((_, index) => (
            <button key={index} type="button" onClick={() => go(index)} aria-label={`${index + 1}번째 글`} aria-current={index === current} className="grid h-6 w-6 place-items-center">
              <span aria-hidden="true" className={`block h-1.5 rounded-full transition-all motion-reduce:transition-none ${index === current ? 'w-5 bg-ink' : 'w-1.5 bg-outline-strong'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
