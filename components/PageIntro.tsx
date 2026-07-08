import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function PageIntro({
  eyebrow,
  title,
  description,
  icon: Icon,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  meta?: ReactNode;
}) {
  return (
    <section className="page-intro">
      {eyebrow && (
        <div className="page-intro-eyebrow">
          {Icon && <Icon className="h-4 w-4" />}
          {eyebrow}
        </div>
      )}
      <h1 className="page-intro-title">{title}</h1>
      {description && <p className="page-intro-description">{description}</p>}
      {meta && <div className="page-intro-meta">{meta}</div>}
    </section>
  );
}
