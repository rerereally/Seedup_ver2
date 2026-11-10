import type { ReactNode } from 'react';

export default function PageIntro({
  title,
  description,
  meta,
  aside,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  /** Sits to the right of the title on wide screens, for a page's one key action or figure. */
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        <h1 className="page-intro-title">{title}</h1>
        {description && <p className="page-intro-description">{description}</p>}
        {meta && <div className="page-intro-meta">{meta}</div>}
      </div>
      {aside}
    </header>
  );
}
