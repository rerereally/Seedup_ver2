'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * An article's own picture from its source site, linking to the article. A plain img on purpose: the sources are many
 * and change, so they cannot all be listed for next/image. When a site refuses the picture, the whole link goes away
 * and the card reads as text.
 */
export default function ArticleImage({ src, href, className }: { src: string; href: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // The title beside it is the same link, so this one stays out of the tab order and away from screen readers.
    <Link href={href} tabIndex={-1} aria-hidden="true" className={`block overflow-hidden rounded-xl border border-outline-soft bg-surface-low ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote hosts vary per source; see the note above */}
      <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
    </Link>
  );
}
