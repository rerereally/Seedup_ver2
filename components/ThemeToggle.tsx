'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';

/** Where the reader's choice is kept; the inline script in the root layout reads the same key before paint. */
const THEME_KEY = 'seedup:theme';
const CHANGED = 'seedup-theme';

// Dark unless the reader picked light (globals.css applies the dark tokens on the same rule).
function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** One button: shows the theme you would switch to, and remembers the choice in this browser. */
export default function ThemeToggle() {
  const t = translator(useLang());
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'dark' as const);
  const next = theme === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the switch still works for this visit.
    }
    window.dispatchEvent(new Event(CHANGED));
  };

  return (
    <button type="button" onClick={toggle} aria-label={next === 'dark' ? t('다크 모드로 보기', 'Switch to dark mode') : t('라이트 모드로 보기', 'Switch to light mode')} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-tertiary transition-colors hover:bg-surface-low hover:text-ink">
      {next === 'dark' ? <Moon className="h-[18px] w-[18px]" aria-hidden="true" /> : <Sun className="h-[18px] w-[18px]" aria-hidden="true" />}
    </button>
  );
}
