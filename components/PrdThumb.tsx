import type { PrdGlance } from '@/lib/opportunities/prd-markdown';

/** A small page of the PRD itself, so a list of them reads as documents rather than rows of titles. */
export default function PrdThumb({ title, glance }: { title: string; glance: PrdGlance | null }) {
  return (
    <div aria-hidden="true" className="flex aspect-[4/3] flex-col overflow-hidden rounded-xl border border-outline-soft bg-surface-low p-4 transition-colors group-hover:border-outline-strong">
      <span className="line-clamp-1 text-[11px] font-bold text-ink">{title}</span>
      <span className="mt-1.5 block h-1 w-3/4 rounded-full bg-surface-high" />
      <span className="mt-1 block h-1 w-1/2 rounded-full bg-surface-high" />
      {glance ? (
        <>
          <span className="mt-3 text-[9px] font-semibold text-muted">요구사항</span>
          <span className="mt-1 grid gap-1">
            {glance.requirements.slice(0, 3).map((row, index) => (
              <span key={index} className="flex items-center gap-1.5 text-[9.5px] leading-tight text-tertiary">
                <span className={`num shrink-0 rounded px-1 ${row.priority === 'P0' ? 'bg-surface-high text-ink' : 'text-muted'}`}>{row.priority ?? `R${index + 1}`}</span>
                <span className="truncate">{row.title}</span>
              </span>
            ))}
          </span>
          <span className="mt-auto flex gap-1">
            {Array.from({ length: Math.min(glance.features, 6) }, (_, index) => <span key={index} className="h-4 flex-1 rounded border border-outline-soft bg-surface" />)}
          </span>
        </>
      ) : (
        <span className="mt-auto grid gap-1">
          <span className="block h-1 w-full rounded-full bg-surface-high" />
          <span className="block h-1 w-5/6 rounded-full bg-surface-high" />
          <span className="block h-1 w-2/3 rounded-full bg-surface-high" />
        </span>
      )}
    </div>
  );
}
