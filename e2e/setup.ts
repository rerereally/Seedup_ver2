import { writeFileSync } from 'node:fs';
import { testSession } from './session';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export default async function setup() {
  const { cookies } = await testSession();
  const host = new URL(BASE).hostname;
  writeFileSync('e2e/.auth.json', JSON.stringify({ cookies: cookies.map((cookie) => ({ ...cookie, domain: host, path: '/', expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: false, secure: BASE.startsWith('https'), sameSite: 'Lax' as const })), origins: [] }));
}
