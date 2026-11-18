'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SignalToSpec from '@/components/landing/SignalToSpec';
import type { DemoPrd } from '@/lib/opportunities/demo-prd';

/**
 * The four steps as one scroll story. On wide screens the demo is pinned on the right, each step's text pins beside it
 * while that step plays, and scrolling drives the demo: which tab, and how far into it. The next step shows faded
 * below. Phones, and readers asking for less motion, get the demo whole and the steps as plain text.
 */
export default function StepStory({ steps, demo, siteUrl }: { steps: Array<{ id: string; head: ReactNode }>; demo: DemoPrd; siteUrl: string }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const refs = useRef<Array<HTMLElement | null>>([]);
  const pin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = pin.current;
      if (!box) return;
      // A step starts when its text reaches the pinned demo's top edge.
      const line = parseFloat(getComputedStyle(box).top) || window.innerHeight * 0.3;
      const tops = refs.current.map((node) => node?.getBoundingClientRect().top ?? Infinity);
      let next = 0;
      tops.forEach((top, index) => { if (top <= line + 1) next = index; });
      // The last step ends when the demo starts to scroll away with the end of the section.
      const end = next + 1 < tops.length ? tops[next + 1] : tops[next] + (refs.current[next]?.offsetHeight ?? 0) - box.offsetHeight;
      const span = Math.max(1, end - tops[next]);
      setActive(next);
      setProgress(wide.matches && !calm.matches ? Math.min(1, Math.max(0, (line - tops[next]) / span)) : undefined);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-x-16 px-5 pt-12 sm:px-6 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-24">
      <div ref={pin} className="mb-10 min-w-0 lg:sticky lg:top-[calc(50vh-17rem)] lg:order-2 lg:mb-0 lg:self-start">
        <SignalToSpec demo={demo} siteUrl={siteUrl} step={active} progress={progress} onStep={(next) => {
          setActive(next);
          const node = refs.current[next];
          const box = pin.current;
          if (node && box) window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - parseFloat(getComputedStyle(box).top), behavior: 'smooth' });
        }} />
      </div>
      <ol className="min-w-0 lg:order-1">
        {steps.map((step, index) => (
          <li
            key={step.id}
            id={step.id}
            ref={(node) => { refs.current[index] = node; }}
            aria-current={index === active ? 'step' : undefined}
            className="scroll-mt-24 py-10 transition-opacity duration-500 lg:h-[60vh] lg:py-0 lg:opacity-30 lg:last:h-[calc(40rem+50vh)] lg:aria-[current=step]:opacity-100"
          >
            <div className="lg:sticky lg:top-[calc(50vh-17rem)] lg:pt-6">{step.head}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
