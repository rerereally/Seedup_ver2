import { cookies } from 'next/headers';
import { LANG_COOKIE, toLang } from './i18n';

export async function getLang() {
  return toLang((await cookies()).get(LANG_COOKIE)?.value);
}
