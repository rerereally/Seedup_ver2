'use client';

import { BookOpenText, ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type RelatedPaperLink = {
  id: string;
  relevance_reason: string | null;
  research_papers: {
    id: string;
    title: string;
    review_type: string | null;
    difficulty: string | null;
    beginner_summary: string | null;
    paper_url: string | null;
  } | null;
};

export default function RelatedPapersToggle({ links }: { links: RelatedPaperLink[] }) {
  const [open, setOpen] = useState(false);
  if (!links.length) return null;

  return (
    <div className="mt-5 rounded-xl border border-outline-soft bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <BookOpenText className="h-5 w-5 text-brand-primary" />
          관련 논문 리뷰
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{links.length}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-outline-soft p-5">
          {links.map((link) => {
            const paper = link.research_papers;
            if (!paper) return null;

            return (
              <article key={link.id} className="rounded-lg border border-surface-high bg-surface p-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">{paper.review_type ?? '논문 리뷰'}</span>
                  {paper.difficulty && <span className="rounded-full border border-outline-soft bg-white px-2.5 py-1 text-xs font-bold text-muted">{paper.difficulty}</span>}
                </div>
                <h3 className="line-clamp-2 text-sm font-bold leading-6 text-ink">{paper.title}</h3>
                {paper.beginner_summary && <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted">{paper.beginner_summary}</p>}
                {link.relevance_reason && <p className="mt-3 border-l-2 border-brand-primary pl-3 text-xs leading-5 text-muted">{link.relevance_reason}</p>}
                {paper.paper_url && (
                  <Link href={paper.paper_url} target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-primary">
                    논문 보기
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
