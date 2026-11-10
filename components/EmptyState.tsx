import Link from 'next/link';

export default function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="empty-state">
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[32em] leading-7 text-muted">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-white transition-opacity hover:opacity-90">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
