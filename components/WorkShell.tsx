import type { ReactNode } from 'react';

/** The "my work" pages' content column. Their links now live in the app sidebar (components/Header.tsx). */
export default function WorkShell({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="page-shell page-stack grow">
      {children}
    </main>
  );
}
