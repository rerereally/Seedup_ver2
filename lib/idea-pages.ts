import { randomBytes } from 'node:crypto';
import { csvCell } from './csv';

export const MAX_PAGES_PER_USER = 5;

/** Ten lowercase letters and digits: short enough to share, too many to guess (36^10). */
export function newPageSlug() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return [...randomBytes(10)].map((byte) => alphabet[byte % alphabet.length]).join('');
}

/** A plain email check; the address is only stored for the page owner, so this keeps out typos, not every invalid form. */
export function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** The page text: what the builder wrote, or the idea itself when they left the headline empty. */
export function pageCopy(idea: string, headline?: unknown, pitch?: unknown) {
  const cleanIdea = idea.trim().slice(0, 300);
  const head = String(headline ?? '').trim().slice(0, 120) || (cleanIdea.length > 120 ? `${cleanIdea.slice(0, 119)}…` : cleanIdea);
  return { idea: cleanIdea, headline: head, pitch: String(pitch ?? '').trim().slice(0, 600) };
}

/** The sign-up list as CSV for the owner, with formula characters neutralised so a spreadsheet does not run them. */
export function signupsCsv(rows: Array<{ email: string; created_at: string }>) {
  return ['email,signed_up_at', ...rows.map((row) => `${csvCell(row.email)},${csvCell(row.created_at)}`)].join('\n');
}
