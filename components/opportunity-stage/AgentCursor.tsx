'use client';

// A pointer that shows where Seedup is working while a PRD is made. It rests on the section being written and moves
// (with one click) only when work moves on: a new heading appears, or a later step turns to another section.
// Decoration only: hidden from screen readers, never takes a click, and still under prefers-reduced-motion.
import { useEffect, useRef, useState, type RefObject } from 'react';

type Point = { x: number; y: number; flip: boolean };

/** Which section to rest on: the first one (nothing written yet), the newest one, or the first heading matching. */
export type CursorTarget = { kind: 'first' } | { kind: 'latest' } | { kind: 'match'; pattern: RegExp };

const STOPS = 'h2, h3, [data-cursor-stop]';
// Room the label needs on the right; nearer the edge it flips to the left so it never widens the page.
const LABEL_ROOM = 150;

/** The end of the last visible text inside `node`, relative to `root`. */
function textEnd(root: HTMLElement, node: Node): Point | null {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (text) => (text.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  let last: Node | null = null;
  while (walker.nextNode()) last = walker.currentNode;
  if (!last) return null;
  const range = document.createRange();
  range.selectNodeContents(last);
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1];
  if (!rect) return null;
  const box = root.getBoundingClientRect();
  const x = Math.min(rect.right - box.left + 4, box.width - 12);
  return { x, y: rect.top - box.top + rect.height * 0.55, flip: x > box.width - LABEL_ROOM };
}

/** The heading the pointer should rest on. */
export function pickStop<T extends { textContent: string | null }>(stops: T[], target: CursorTarget): T | null {
  if (!stops.length) return null;
  if (target.kind === 'first') return stops[0];
  if (target.kind === 'match') return stops.find((stop) => target.pattern.test(stop.textContent ?? '')) ?? stops[stops.length - 1];
  return stops[stops.length - 1];
}

export default function AgentCursor({ rootRef, target, label, tick }: { rootRef: RefObject<HTMLElement | null>; target: CursorTarget; label: string; tick: number }) {
  const [point, setPoint] = useState<Point | null>(null);
  const [clicks, setClicks] = useState(0);
  const resting = useRef<Element | null>(null);
  const key = target.kind === 'match' ? target.pattern.source : target.kind;

  // Re-measured as text arrives, but it moves only when the section it should rest on changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(() => {
      const stop = pickStop([...root.querySelectorAll(STOPS)], target);
      const next = stop && textEnd(root, stop);
      if (!stop || !next) return;
      if (stop !== resting.current) {
        resting.current = stop;
        setClicks((count) => count + 1);
      }
      setPoint((current) => (current && current.x === next.x && current.y === next.y ? current : next));
    });
    return () => cancelAnimationFrame(frame);
    // `key` stands for `target`, whose object identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, key, tick]);

  return (
    <div
      aria-hidden="true"
      className="agent-cursor pointer-events-none absolute left-0 top-0 z-10 flex items-start"
      style={{ transform: `translate(${point?.x ?? 0}px, ${point?.y ?? 0}px)`, opacity: point ? 1 : 0 }}
    >
      {clicks > 0 && <span key={`ring${clicks}`} className="agent-cursor-click absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-seed" />}
      <svg key={`press${clicks}`} viewBox="0 0 20 20" className="agent-cursor-press relative h-5 w-5 drop-shadow-sm">
        <path d="M3 1.8 16.6 10.6l-6.1 1.1-3.4 6.3Z" fill="var(--color-ink)" stroke="var(--color-white)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className={`${point?.flip ? 'absolute right-5 top-3.5' : 'ml-0.5 mt-3.5'} whitespace-nowrap rounded-full bg-seed px-2 py-0.5 text-[11px] font-semibold leading-4 text-on-seed shadow-sm`}>{label}</span>
    </div>
  );
}
