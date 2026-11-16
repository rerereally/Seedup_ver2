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
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[32em] leading-7 text-muted">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn mt-6">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
