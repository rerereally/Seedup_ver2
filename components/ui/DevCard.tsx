import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type DevCardProps<T extends ElementType> = {
  as?: T;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'title' | 'children' | 'className'>;

export function DevCard<T extends ElementType = 'article'>({
  as,
  eyebrow,
  title,
  description,
  meta,
  action,
  children,
  className = '',
  ...props
}: DevCardProps<T>) {
  const Component = as ?? 'article';

  return (
    <Component
      className={`group border border-outline-soft bg-white p-5 transition-colors hover:border-ink ${className}`}
      {...props}
    >
      {(eyebrow || meta) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold uppercase text-muted">
          {eyebrow && <div>{eyebrow}</div>}
          {meta && <div>{meta}</div>}
        </div>
      )}
      {title && <h3 className="text-lg font-black leading-snug text-ink group-hover:underline">{title}</h3>}
      {description && <p className="mt-3 text-sm leading-6 text-muted">{description}</p>}
      {children}
      {action && <div className="mt-5 border-t border-outline-soft pt-4">{action}</div>}
    </Component>
  );
}

export function DevTag({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex h-6 items-center border px-2 text-[11px] font-bold uppercase ${active ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-surface text-muted'}`}>
      {children}
    </span>
  );
}

export function DevSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-outline-soft pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-xs font-bold uppercase text-muted">{eyebrow}</div>}
        <h2 className="text-2xl font-black leading-tight text-ink md:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
