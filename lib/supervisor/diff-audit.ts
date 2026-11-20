// Static check of a diff (docs/supervisor-plan.md 3-5): blockers stop a commit or a verification before any model runs,
// warnings go to the verifier to judge. Regex only, added lines only, so it runs the same on the server and in the
// local hook. Secrets are masked in the diff handed to a model.
import { createHash } from 'node:crypto';
import type { AuditCode, AuditFinding, AuditSeverity, DiffAuditResult } from './types';

type AddedLine = { file: string; line: number; text: string };
type DiffFile = { path: string; isNew: boolean; added: AddedLine[] };

const TEST_FILE = /(^|\/)(tests?|__tests__|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const FIXTURE = /(^|\/)(fixtures?|__fixtures__|__mocks__|mocks?)\//;
const DOC = /\.(md|mdx|txt|rst)$|(^|\/)docs\//;
const GENERATED = /(^|\/)(\.next|dist|build|out|coverage|node_modules)\/|(\.lock|-lock\.json|-lock\.yaml|\.min\.[cm]?js|\.snap|\.map)$|(^|\/)(schema-manifest\.json|cloudflare-env\.d\.ts|next-env\.d\.ts)$/;

const isTest = (path: string) => TEST_FILE.test(path);
const isCode = (path: string) => !isTest(path) && !FIXTURE.test(path) && !DOC.test(path) && !GENERATED.test(path);

/** Files and their added lines (with new-file line numbers) from a unified diff. */
export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let line = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      current = { path: raw.split(' b/').pop() ?? '', isNew: false, added: [] };
      files.push(current);
    } else if (!current) {
      continue;
    } else if (raw.startsWith('new file mode')) {
      current.isNew = true;
    } else if (raw.startsWith('+++ ')) {
      const path = raw.slice(4).replace(/^b\//, '');
      if (path !== '/dev/null') current.path = path;
    } else if (raw.startsWith('@@')) {
      line = Number(/\+(\d+)/.exec(raw)?.[1] ?? 1);
    } else if (raw.startsWith('+')) {
      current.added.push({ file: current.path, line, text: raw.slice(1) });
      line++;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) {
      line++;
    }
  }
  return files;
}

// Known secret shapes. Each match is a blocker and is masked before the diff reaches a model.
const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['OpenAI/OpenRouter key', /sk-(?!ant-)(?:proj-|or-v1-)?[A-Za-z0-9_-]{32,}/g],
  ['GitHub token', /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Slack token', /xox[abprs]-[A-Za-z0-9-]{10,}/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Stripe live key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g],
  ['Seedup MCP token', /\bsdp_[a-f0-9]{48}\b/g],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['Private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
];
// A long random-looking string assigned to a name that sounds secret.
const SECRET_ASSIGN = /\b[\w.-]*(?:secret|token|api[_-]?key|password|passwd|private[_-]?key)[\w.-]*["']?\s*[:=]\s*["'`]([^"'`\s]{20,})["'`]/gi;

function entropy(value: string) {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  return [...counts.values()].reduce((sum, count) => sum - (count / value.length) * Math.log2(count / value.length), 0);
}

type Scope = 'all' | 'test' | 'code';
/** A rule as plain data, so the local pre-commit script (lib/supervisor/local-audit.ts) reads the very same rules. */
export type RuleData = { code: AuditCode; severity: AuditSeverity; scope: Scope; pattern: string; flags?: string; strip?: string; message: string; fixHint: string };

export const RULE_DATA: RuleData[] = [
  // Code only: tests and docs name these variables without shipping them. Provider API keys count even as *_API_KEY.
  { code: 'SEC_CLIENT_SECRET', severity: 'blocker', scope: 'code', pattern: String.raw`\bNEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|_TOKEN)\b|\bNEXT_PUBLIC_[A-Z0-9_]*(OPENAI|ANTHROPIC|OPENROUTER|GROQ|MISTRAL|COHERE|RESEND|SENDGRID|TWILIO|STRIPE_SECRET|AWS)[A-Z0-9_]*\b`,
    message: '브라우저로 내려가는 NEXT_PUBLIC_ 변수에 비밀값 이름이 붙었습니다.', fixHint: '서버 전용 이름(NEXT_PUBLIC_ 없이)으로 바꾸고 서버에서만 읽으세요.' },
  { code: 'LIE_SKIPPED_TEST', severity: 'blocker', scope: 'test', pattern: String.raw`\b(?:it|test|describe)\.(?:skip|todo)\s*\(|\bx(?:it|describe)\s*\(|\{\s*skip:\s*true\s*\}`,
    message: '새로 건너뛴 테스트가 있습니다.', fixHint: '테스트를 고치거나, 건너뛰는 이유를 seedup-allow로 남기세요.' },
  // seedup-allow: LIE_EMPTY_IMPL this line is the rule's own pattern
  { code: 'LIE_EMPTY_IMPL', severity: 'blocker', scope: 'code', pattern: String.raw`throw new Error\(\s*["'\`][^"'\`]*not implemented|NotImplementedError|todo!\(\)|unimplemented!\(\)`, flags: 'i',
    message: '구현 대신 "not implemented" 예외가 들어갔습니다.', fixHint: '기능을 구현하거나 완료 보고에서 빼세요.' },
  { code: 'LIE_TODO', severity: 'warning', scope: 'code', pattern: String.raw`(?:\/\/|\/\*|#|<!--|\{\/\*)\s*(TODO|FIXME|XXX|HACK)\b`,
    message: 'TODO 주석이 남았습니다.', fixHint: '끝내거나, 남은 일로 기능 상태에 적으세요.' },
  { code: 'LIE_MOCK', severity: 'warning', scope: 'code', pattern: String.raw`\b(?:[Mm]ock|MOCK|[Dd]ummy|[Ff]ake|[Pp]laceholder|[Ll]orem ipsum|[Hh]ard-?coded)\b|\b(?:mock|dummy|fake|placeholder)[A-Z]\w*`, strip: String.raw`\bplaceholder\s*=\s*["{]`,
    message: '가짜 · 임시 값으로 보이는 코드가 있습니다.', fixHint: '실제 구현으로 바꾸거나 Mock이 의도된 것인지 적으세요.' },
  { code: 'LIE_EMPTY_CATCH', severity: 'warning', scope: 'code', pattern: String.raw`\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}`,
    message: '오류를 삼키는 빈 catch가 있습니다.', fixHint: '처리하거나, 무시해도 되는 이유를 catch 안 주석으로 남기세요.' },
  { code: 'LIE_EMPTY_IMPL', severity: 'warning', scope: 'code', pattern: String.raw`\bfunction\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*\}`,
    message: '본문이 빈 함수가 있습니다.', fixHint: '구현하거나 빈 이유를 주석으로 남기세요.' },
  // seedup-allow: SEC_XSS this line is the rule's own pattern
  { code: 'SEC_XSS', severity: 'warning', scope: 'code', pattern: String.raw`dangerouslySetInnerHTML|\.(?:inner|outer)HTML\s*=|\beval\s*\(|new Function\s*\(`,
    message: 'HTML을 그대로 넣거나 문자열을 코드로 실행합니다.', fixHint: '사용자 입력이 들어가지 않는지 확인하고, 들어가면 이스케이프하세요.' },
  { code: 'SEC_SQLI', severity: 'warning', scope: 'code', pattern: String.raw`\`[^\`]*\b(?:select|insert|update|delete)\b[^\`]*\$\{|["'][^"']*\b(?:select|insert into|update|delete from)\b[^"']*["']\s*\+`, flags: 'i',
    message: 'SQL을 문자열로 이어 붙입니다.', fixHint: '매개변수 쿼리나 쿼리 빌더를 쓰세요.' },
];

const inScope = (scope: Scope, path: string) => (scope === 'all' ? !GENERATED.test(path) : scope === 'test' ? isTest(path) : isCode(path));
const RULES = RULE_DATA.map((rule) => ({ ...rule, regex: new RegExp(rule.pattern, rule.flags), stripRegex: rule.strip ? new RegExp(rule.strip, 'g') : null }));

const AUTH_CALL = /getCurrentUser|getUser\(|getClaims|auth\(\)|userForToken|requireAdmin|isAdmin|verifyToken|verifySignature|CRON_SECRET|authorization/i;
const WRITE_HANDLER = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\b/;
const API_ROUTE = /(^|\/)app\/api\/.*\/route\.[cm]?[jt]s$|(^|\/)pages\/api\//;

const OPEN_CATCH = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*$/;
const CLOSE_ONLY = /^\s*\}/;
const ALLOW = /seedup-allow:\s*([A-Z_]+)\s+(.+?)\s*(?:\*\/|-->)?$/;

/** The `seedup-allow: <CODE> <reason>` on the line or the line above, if it names this code. */
function allowance(file: DiffFile, index: number, code: AuditCode) {
  for (const line of [file.added[index], file.added[index - 1]]) {
    const match = line && ALLOW.exec(line.text);
    if (match && match[1] === code && line.line >= file.added[index].line - 1) return match[2];
  }
  return undefined;
}

/**
 * Audits the added lines of a unified diff. Allowed findings stay listed (the dashboard shows every exception) but do not
 * count. `passed` means no blocker; warnings go to the verifier.
 */
export function auditDiff(diff: string): DiffAuditResult {
  const findings: AuditFinding[] = [];
  const add = (file: DiffFile, index: number, code: AuditCode, severity: AuditSeverity, snippet: string, message: string, fixHint: string) => {
    const at = file.added[index];
    const allowed = allowance(file, index, code);
    findings.push({ code, category: code.startsWith('SEC') ? 'security' : 'lie', severity, file: at.file, line: at.line, snippet: snippet.slice(0, 120), message, fixHint, ...(allowed ? { allowed } : {}) });
  };

  const files = parseDiff(diff);
  for (const file of files) {
    file.added.forEach((line, index) => {
      if (!GENERATED.test(file.path)) {
        for (const [name, pattern] of SECRET_PATTERNS) {
          for (const match of line.text.matchAll(pattern)) add(file, index, 'SEC_SECRET_LEAK', 'blocker', `${match[0].slice(0, 6)}…`, `${name}로 보이는 값이 코드에 들어갔습니다.`, '값을 지우고 .env로 옮긴 뒤, 이미 올라갔다면 키를 폐기하고 새로 발급하세요.');
        }
        if (isCode(file.path)) {
          for (const match of line.text.matchAll(SECRET_ASSIGN)) {
            if (entropy(match[1]) >= 3.5 && !/^(?:process\.env|import\.meta\.env)/.test(match[1]) && !SECRET_PATTERNS.some(([, pattern]) => new RegExp(pattern.source).test(match[1]))) {
              add(file, index, 'SEC_SECRET_LEAK', 'blocker', `${match[1].slice(0, 4)}…`, '비밀값 이름에 무작위 문자열이 들어갔습니다.', '값을 .env로 옮기고 코드에서는 환경 변수로 읽으세요.');
            }
          }
        }
      }
      for (const rule of RULES) {
        if (!inScope(rule.scope, file.path)) continue;
        const hit = rule.regex.exec(rule.stripRegex ? line.text.replace(rule.stripRegex, '') : line.text)?.[0];
        if (hit) add(file, index, rule.code, rule.severity, hit, rule.message, rule.fixHint);
      }
    });
    // An empty catch split over two lines: `catch (error) {` then a line that only closes it.
    if (isCode(file.path)) {
      file.added.forEach((line, index) => {
        const next = file.added[index + 1];
        if (OPEN_CATCH.test(line.text) && next && next.line === line.line + 1 && CLOSE_ONLY.test(next.text)) {
          add(file, index, 'LIE_EMPTY_CATCH', 'warning', line.text.trim(), '오류를 삼키는 빈 catch가 있습니다.', '처리하거나, 무시해도 되는 이유를 catch 안 주석으로 남기세요.');
        }
      });
    }
    if (file.isNew && API_ROUTE.test(file.path)) {
      const body = file.added.map((line) => line.text).join('\n');
      const handler = file.added.findIndex((line) => WRITE_HANDLER.test(line.text));
      if (handler >= 0 && !AUTH_CALL.test(body)) add(file, handler, 'SEC_NO_AUTH', 'warning', file.added[handler].text.trim(), '쓰기 API에 인증 확인이 보이지 않습니다.', '로그인 사용자나 토큰을 확인한 뒤 처리하세요.');
    }
  }

  const { scrubbed, count } = scrubSecrets(diff);
  const counted = findings.filter((row) => !row.allowed);
  const blockerCount = counted.filter((row) => row.severity === 'blocker').length;
  return {
    passed: blockerCount === 0,
    blockerCount,
    warningCount: counted.length - blockerCount,
    findings,
    scrubbedDiff: scrubbed,
    redactedCount: count,
    diffHash: createHash('sha256').update(diff).digest('hex'),
  };
}

/** The diff with every known secret shape and secret-named long value masked, for the model input. */
export function scrubSecrets(diff: string) {
  let count = 0;
  let scrubbed = diff;
  for (const [name, pattern] of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, () => { count++; return `[REDACTED ${name}]`; });
  }
  scrubbed = scrubbed.replace(SECRET_ASSIGN, (whole, value: string) => {
    if (entropy(value) < 3.5) return whole;
    count++;
    return whole.replace(value, '[REDACTED secret]');
  });
  return { scrubbed, count };
}

/** Everything the standalone local script needs, as plain strings (lib/supervisor/local-audit.ts). */
export const PORTABLE_AUDIT = {
  paths: { test: TEST_FILE.source, fixture: FIXTURE.source, doc: DOC.source, generated: GENERATED.source },
  secrets: SECRET_PATTERNS.map(([name, pattern]) => [name, pattern.source] as const),
  secretAssign: SECRET_ASSIGN.source,
  rules: RULE_DATA,
  auth: { call: AUTH_CALL.source, write: WRITE_HANDLER.source, route: API_ROUTE.source },
  allow: ALLOW.source,
  catchSplit: { open: OPEN_CATCH.source, close: CLOSE_ONLY.source },
};
