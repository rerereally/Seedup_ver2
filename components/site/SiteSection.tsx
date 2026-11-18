import type { ReactNode } from 'react';

/** The intro pages' opening: one English line as the big word, then the Korean (or English) line under it. */
export function SiteHero({ word, title, lead, children }: { word: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="site-hero">
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-0 h-[460px] w-[760px] max-w-full rounded-full bg-glow blur-3xl" />
      <div className="relative mx-auto w-full max-w-[1280px] px-5 pb-6 pt-16 sm:px-6 md:px-8 lg:pt-24">
        <p className="t-display font-mono text-[clamp(36px,5vw,68px)] tracking-[-0.05em]" aria-hidden="true">{word}</p>
        <h1 id="site-hero" className="mt-4 text-[clamp(22px,2.4vw,30px)] font-bold leading-snug tracking-[-0.025em] [text-wrap:balance]">{title}</h1>
        {lead && <p className="t-lead mt-4 max-w-[38em]">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

/** One row of an intro page, the Toss way: a small label on the left, the content on the right. */
export function SiteRow({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <section className="reveal mx-auto grid w-full max-w-[1280px] gap-x-12 gap-y-4 border-t border-outline-soft px-5 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:px-8 md:py-20">
      <p className="site-label flex items-center gap-2 self-start md:sticky md:top-24 md:pt-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-seed" />{label}</p>
      <div className="min-w-0">
        {title && <h2 className="text-[clamp(24px,2.6vw,34px)] font-bold leading-snug tracking-[-0.03em] [text-wrap:balance]">{title}</h2>}
        <div className={title ? 'mt-5' : ''}>{children}</div>
      </div>
    </section>
  );
}

/** Numbered points (01, 02, ...) with a title and a line each. */
export function NumberedList({ items }: { items: Array<[string, string]> }) {
  return (
    <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
      {items.map(([title, body], index) => (
        <li key={title}>
          <p className="font-mono text-[13px] font-semibold text-seed">{String(index + 1).padStart(2, '0')}</p>
          <h3 className="mt-2 text-[18px] font-semibold leading-snug">{title}</h3>
          <p className="mt-1.5 text-[15px] leading-7 text-tertiary">{body}</p>
        </li>
      ))}
    </ol>
  );
}

/** A legal document as numbered sections, each a heading and its paragraphs or list items (lines starting with "- "). */
export function LegalSections({ sections }: { sections: Array<[string, string[]]> }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-20 sm:px-6 md:px-8">
      {sections.map(([title, lines], index) => {
        const items = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
        const paragraphs = lines.filter((line) => !line.startsWith('- '));
        return (
          <section key={title} className="border-t border-outline-soft py-8">
            <h2 className="text-[19px] font-bold tracking-[-0.015em]"><span className="num mr-2 text-seed">{index + 1}.</span>{title}</h2>
            {paragraphs.map((line) => <p key={line} className="mt-3 text-[15px] leading-7 text-tertiary">{line}</p>)}
            {items.length > 0 && <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-[15px] leading-7 text-tertiary marker:text-outline-strong">{items.map((line) => <li key={line}>{line}</li>)}</ul>}
          </section>
        );
      })}
    </div>
  );
}
