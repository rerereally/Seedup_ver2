/** The Seedup mark: a seed, and up. */
export default function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-seed`} fill="none" aria-hidden="true">
      <path d="M4.5 12.5 12 5l7.5 7.5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="19" r="2.8" fill="currentColor" />
    </svg>
  );
}
