// Two languages, chosen by a cookie. Strings live next to the UI that uses them: t('한국어', 'English').
export type Lang = 'ko' | 'en';

export const LANG_COOKIE = 'seedup_lang';

export const toLang = (value?: string | null): Lang => (value === 'en' ? 'en' : 'ko');

export const translator = (lang: Lang) => (ko: string, en: string) => (lang === 'en' ? en : ko);
