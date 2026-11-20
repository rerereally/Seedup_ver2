// The supervisor-verified token (docs/supervisor-plan.md 3-4): issued only when the server judged every criterion met
// for one user, project, feature and commit SHA. A done report that carries a valid token for that exact SHA shows
// 🟢 supervisor_verified; without one it stays 🔵 or ⚪. Signed with the server secret; agents can read it, not forge it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mcpTokenSecret } from '../mcp/auth';
import type { VerificationTokenPayload } from './types';

const PREFIX = 'svt1';
const DAY = 24 * 60 * 60;

const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
// Domain-separated from MCP tokens, which use the same server secret.
const sign = (body: string, key: string) => createHmac('sha256', `seedup-verify:${key}`).update(`${PREFIX}.${body}`).digest('base64url');

/** Signs a token for one verified (user, project, feature, SHA). Expires in 30 days unless `exp` is given. */
export function signVerificationToken(payload: Omit<VerificationTokenPayload, 'exp'> & { exp?: number }, key = mcpTokenSecret(), now = Date.now()): string {
  if (!key) throw new Error('No server secret to sign verification tokens');
  const full: VerificationTokenPayload = { ...payload, exp: payload.exp ?? Math.floor(now / 1000) + 30 * DAY };
  const body = b64(JSON.stringify(full));
  return `${PREFIX}.${body}.${sign(body, key)}`;
}

/**
 * The payload if the token is ours, unexpired and issued for exactly this user, project, feature and SHA; else null.
 * A token for an older SHA does not cover a newer commit.
 */
export function readVerificationToken(token: string, expected: Omit<VerificationTokenPayload, 'exp'>, key = mcpTokenSecret(), now = Date.now()): VerificationTokenPayload | null {
  const [prefix, body, signature, extra] = token.split('.');
  if (!key || prefix !== PREFIX || !body || !signature || extra !== undefined) return null;
  const want = Buffer.from(sign(body, key));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let payload: VerificationTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as VerificationTokenPayload;
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
  const same = payload.userId === expected.userId && payload.projectKey === expected.projectKey
    && payload.featureId === expected.featureId && payload.sha.toLowerCase() === expected.sha.toLowerCase();
  return same ? payload : null;
}
