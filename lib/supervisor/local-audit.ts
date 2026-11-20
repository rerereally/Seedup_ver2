// The stage-1 local check (docs/supervisor-plan.md 3-4): a standalone Node script the hook bundle drops into the user's
// repository. It reads a unified diff on stdin and applies the same rules as auditDiff, taken from PORTABLE_AUDIT, so
// the server and the pre-commit hook cannot disagree on what a rule is. Blockers exit 1 (the commit stops); warnings
// only print. tests/supervisor-local-audit.test.ts runs this script against auditDiff to keep the two engines equal.
import { PORTABLE_AUDIT } from './diff-audit';

const ENGINE = String.raw`
const re = (source, flags = '') => new RegExp(source, flags);
const P = { test: re(A.paths.test), fixture: re(A.paths.fixture), doc: re(A.paths.doc), generated: re(A.paths.generated) };
const isTest = (path) => P.test.test(path);
const isCode = (path) => !isTest(path) && !P.fixture.test(path) && !P.doc.test(path) && !P.generated.test(path);
const inScope = (scope, path) => (scope === 'all' ? !P.generated.test(path) : scope === 'test' ? isTest(path) : isCode(path));
const SECRETS = A.secrets.map(([name, source]) => [name, re(source, 'g')]);
const ASSIGN = re(A.secretAssign, 'gi');
const RULES = A.rules.map((rule) => ({ ...rule, regex: re(rule.pattern, rule.flags || ''), stripRegex: rule.strip ? re(rule.strip, 'g') : null }));
const ALLOW = re(A.allow);
const AUTH = re(A.auth.call, 'i');
const WRITE = re(A.auth.write);
const ROUTE = re(A.auth.route);
const OPEN_CATCH = re(A.catchSplit.open);
const CLOSE_ONLY = re(A.catchSplit.close);

function parse(diff) {
  const files = [];
  let current = null;
  let line = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) { current = { path: raw.split(' b/').pop() || '', isNew: false, added: [] }; files.push(current); }
    else if (!current) continue;
    else if (raw.startsWith('new file mode')) current.isNew = true;
    else if (raw.startsWith('+++ ')) { const path = raw.slice(4).replace(/^b\//, ''); if (path !== '/dev/null') current.path = path; }
    else if (raw.startsWith('@@')) line = Number((/\+(\d+)/.exec(raw) || [])[1] || 1);
    else if (raw.startsWith('+')) { current.added.push({ file: current.path, line, text: raw.slice(1) }); line++; }
    else if (!raw.startsWith('-') && !raw.startsWith('\\')) line++;
  }
  return files;
}

function entropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  return [...counts.values()].reduce((sum, count) => sum - (count / value.length) * Math.log2(count / value.length), 0);
}

function allowance(file, index, code) {
  for (const line of [file.added[index], file.added[index - 1]]) {
    const match = line && ALLOW.exec(line.text);
    if (match && match[1] === code && line.line >= file.added[index].line - 1) return match[2];
  }
  return undefined;
}

function audit(diff) {
  const findings = [];
  const add = (file, index, code, severity, message) => {
    const at = file.added[index];
    const allowed = allowance(file, index, code);
    findings.push({ code, severity, file: at.file, line: at.line, message, ...(allowed ? { allowed } : {}) });
  };
  for (const file of parse(diff)) {
    file.added.forEach((line, index) => {
      if (!P.generated.test(file.path)) {
        for (const [name, pattern] of SECRETS) for (const _ of line.text.matchAll(pattern)) add(file, index, 'SEC_SECRET_LEAK', 'blocker', name + '로 보이는 값이 코드에 들어갔습니다.');
        if (isCode(file.path)) {
          for (const match of line.text.matchAll(ASSIGN)) {
            if (entropy(match[1]) >= 3.5 && !/^(?:process\.env|import\.meta\.env)/.test(match[1]) && !SECRETS.some(([, pattern]) => re(pattern.source).test(match[1]))) {
              add(file, index, 'SEC_SECRET_LEAK', 'blocker', '비밀값 이름에 무작위 문자열이 들어갔습니다.');
            }
          }
        }
      }
      for (const rule of RULES) {
        if (!inScope(rule.scope, file.path)) continue;
        if (rule.regex.exec(rule.stripRegex ? line.text.replace(rule.stripRegex, '') : line.text)) add(file, index, rule.code, rule.severity, rule.message);
      }
    });
    if (isCode(file.path)) {
      file.added.forEach((line, index) => {
        const next = file.added[index + 1];
        if (OPEN_CATCH.test(line.text) && next && next.line === line.line + 1 && CLOSE_ONLY.test(next.text)) add(file, index, 'LIE_EMPTY_CATCH', 'warning', '오류를 삼키는 빈 catch가 있습니다.');
      });
    }
    if (file.isNew && ROUTE.test(file.path)) {
      const handler = file.added.findIndex((line) => WRITE.test(line.text));
      if (handler >= 0 && !AUTH.test(file.added.map((line) => line.text).join('\n'))) add(file, handler, 'SEC_NO_AUTH', 'warning', '쓰기 API에 인증 확인이 보이지 않습니다.');
    }
  }
  return findings;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const findings = audit(input);
  const counted = findings.filter((row) => !row.allowed);
  const blockers = counted.filter((row) => row.severity === 'blocker');
  const mode = process.argv[2];
  if (mode === '--json') { process.stdout.write(JSON.stringify(findings)); return; }
  if (mode === '--count') { process.stdout.write(String(blockers.length)); return; }
  for (const row of counted) console.log((row.severity === 'blocker' ? '차단 ' : '경고 ') + row.code + ' ' + row.file + ':' + row.line + ' ' + row.message);
  if (blockers.length) {
    console.log('Seedup: 차단 ' + blockers.length + '개 때문에 커밋을 멈췄습니다. 고치거나, 의도한 것이면 그 줄에 "// seedup-allow: <코드> <이유>"를 적으세요.');
    process.exitCode = 1;
  }
});
`;

/** The script's source, rules inlined. Plain Node, no packages; it reads only stdin and never touches the network. */
export function localAuditScript(): string {
  return `#!/usr/bin/env node
// Seedup local check, generated from Seedup's rules. Reads a diff on stdin: blockers exit 1, warnings only print.
// --json prints every finding, --count prints the blocker count. Never sends anything anywhere.
const A = ${JSON.stringify(PORTABLE_AUDIT)};
${ENGINE.trim()}
`;
}
