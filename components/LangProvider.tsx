'use client';

import { createContext, useContext } from 'react';
import type { Lang } from '@/lib/i18n';
import { LANG_COOKIE } from '@/lib/i18n';

const LangContext = createContext<Lang>('ko');

export default function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Remembers the choice for a year; the caller refreshes so server components render in the new language. */
export function saveLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}
