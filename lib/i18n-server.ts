import type { Lang } from './i18n';

// shortcut: Korean only while the English switch is off; a `seedup_lang` cookie left from it is ignored.
// To bring English back, read that cookie here again (toLang(cookies().get(LANG_COOKIE)?.value)) and restore the switch.
export async function getLang(): Promise<Lang> {
  return 'ko';
}
