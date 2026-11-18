'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 900;

/**
 * A number that counts up from zero the first time it scrolls into view. The server renders the real value, so a reader
 * without JavaScript, or one who asked for less motion, sees it at once.
 */
export default function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Already on screen at load: leave the number as it is rather than flash it back to zero.
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION_MS);
        setShown(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    setShown(0);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={ref}>{shown.toLocaleString('en-US')}</span>;
}
