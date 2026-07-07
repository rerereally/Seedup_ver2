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
    <div className="rounded-xl border border-dashed border-outline-soft bg-white p-10 text-center">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-6 inline-flex rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
