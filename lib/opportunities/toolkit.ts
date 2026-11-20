// Open-source tools, agent skills and checks a PRD recommends. No model picks or names them: they come only from this
// reviewed list, matched to the PRD's own words by rules, so a PRD never points at a package that does not exist.
// Every repo here is checked by scripts/check-toolkit.ts (exists, not archived, licence, last push) before it ships.
import type { Spec } from './spec';

export type ToolStage = 'build' | 'before-deploy' | 'after-deploy';
export type ToolKind = 'library' | 'skill' | 'check';

export type Tool = {
  id: string;
  name: string;
  kind: ToolKind;
  stage: ToolStage;
  /** GitHub owner/name, checked by scripts/check-toolkit.ts. */
  repo: string;
  url: string;
  why: [string, string];
  /** Set when the repo has no single licence (each item carries its own); the check then accepts it. */
  licencePerItem?: true;
  /** When the PRD's words match, the tool is recommended for the features that match. No pattern: every PRD gets it. */
  when?: RegExp;
};

export const TOOLKIT: Tool[] = [
  // Build
  { id: 'shadcn-ui', name: 'shadcn/ui', kind: 'library', stage: 'build', repo: 'shadcn-ui/ui', url: 'https://ui.shadcn.com', why: ['접근성을 갖춘 화면 부품을 코드로 복사해 와서 고쳐 쓸 수 있습니다.', 'Accessible UI parts you copy in and own.'], when: /화면|대시보드|웹|폼|입력|목록|UI|screen|dashboard|web|form|page/i },
  { id: 'zod', name: 'Zod', kind: 'library', stage: 'build', repo: 'colinhacks/zod', url: 'https://zod.dev', why: ['입력과 API 요청을 한곳에서 검증합니다.', 'Validates input and API payloads in one place.'], when: /입력|폼|API|요청|업로드|설정|input|form|request|upload|config/i },
  { id: 'better-auth', name: 'Better Auth', kind: 'library', stage: 'build', repo: 'better-auth/better-auth', url: 'https://www.better-auth.com', why: ['로그인, 세션, 소셜 로그인을 직접 짜지 않게 해 줍니다.', 'Sign-in, sessions and social login without writing your own.'], when: /로그인|인증|계정|회원|권한|login|sign.?in|auth|account|permission/i },
  { id: 'stripe', name: 'Stripe Node', kind: 'library', stage: 'build', repo: 'stripe/stripe-node', url: 'https://docs.stripe.com', why: ['결제와 구독을 카드 정보를 직접 다루지 않고 붙입니다.', 'Payments and subscriptions without handling card data.'], when: /결제|구독|요금|청구|payment|billing|subscription|checkout|pricing/i },
  { id: 'drizzle', name: 'Drizzle ORM', kind: 'library', stage: 'build', repo: 'drizzle-team/drizzle-orm', url: 'https://orm.drizzle.team', why: ['타입이 맞는 SQL과 마이그레이션을 씁니다.', 'Typed SQL and migrations.'], when: /저장|데이터베이스|DB|테이블|기록|이력|store|database|table|history|persist/i },
  { id: 'ai-sdk', name: 'AI SDK', kind: 'library', stage: 'build', repo: 'vercel/ai', url: 'https://ai-sdk.dev', why: ['여러 LLM 제공사를 같은 코드로 부르고 스트리밍합니다.', 'Calls and streams many LLM providers with one API.'], when: /\bAI\b|LLM|모델|에이전트|요약|생성|GPT|Claude|agent|summari[sz]e|generate/i },
  { id: 'mcp-sdk', name: 'MCP TypeScript SDK', kind: 'library', stage: 'build', repo: 'modelcontextprotocol/typescript-sdk', url: 'https://modelcontextprotocol.io', why: ['AI 도구가 읽을 수 있는 MCP 서버를 표준대로 만듭니다.', 'Builds an MCP server AI tools can read, to the standard.'], when: /MCP|에이전트.*(연결|도구)|코딩 (도구|에이전트)|Claude Code|Cursor|agent tool/i },
  { id: 'agent-skills', name: 'Anthropic Agent Skills', kind: 'skill', stage: 'build', repo: 'anthropics/skills', url: 'https://github.com/anthropics/skills', licencePerItem: true, why: ['코딩 에이전트에 붙이는 공개 스킬 모음입니다. 웹앱 테스트, 프런트엔드 디자인 같은 스킬을 골라 쓰고, 스킬마다 라이선스를 확인하세요.', 'Public skills for coding agents, such as web app testing and front-end design. Each skill has its own licence.'] },
  // Before deploy
  { id: 'playwright', name: 'Playwright', kind: 'check', stage: 'before-deploy', repo: 'microsoft/playwright', url: 'https://playwright.dev', why: ['P0 수락 기준을 실제 브라우저에서 확인하는 테스트를 씁니다.', 'Tests P0 acceptance criteria in a real browser.'] },
  { id: 'gitleaks', name: 'Gitleaks', kind: 'check', stage: 'before-deploy', repo: 'gitleaks/gitleaks', url: 'https://gitleaks.io', why: ['API 키나 비밀번호가 코드에 들어갔는지 커밋 전에 찾습니다.', 'Finds API keys and passwords committed to the code.'] },
  { id: 'semgrep', name: 'Semgrep', kind: 'check', stage: 'before-deploy', repo: 'semgrep/semgrep', url: 'https://semgrep.dev', why: ['인증 없는 API, 주입 같은 흔한 보안 실수를 코드에서 찾습니다.', 'Finds common security mistakes such as unauthenticated routes and injection.'] },
  { id: 'osv-scanner', name: 'OSV-Scanner', kind: 'check', stage: 'before-deploy', repo: 'google/osv-scanner', url: 'https://google.github.io/osv-scanner', why: ['의존성에 알려진 취약점이 있는지 확인합니다.', 'Checks dependencies for known vulnerabilities.'] },
  // After deploy
  { id: 'sentry', name: 'Sentry', kind: 'check', stage: 'after-deploy', repo: 'getsentry/sentry-javascript', url: 'https://docs.sentry.io', why: ['배포 뒤 사용자에게 난 오류를 모아 알려 줍니다.', 'Collects the errors users hit after release.'] },
  { id: 'lighthouse-ci', name: 'Lighthouse CI', kind: 'check', stage: 'after-deploy', repo: 'GoogleChrome/lighthouse-ci', url: 'https://github.com/GoogleChrome/lighthouse-ci', why: ['배포된 화면의 성능, 접근성 점수가 떨어지면 알립니다.', 'Flags drops in performance and accessibility on the live pages.'], when: /화면|대시보드|웹|페이지|UI|screen|dashboard|web|page/i },
];

export type Recommendation = { tool: Tool; features: string[] };

/**
 * The tools this PRD should use, in build → before deploy → after deploy order. A tool with a pattern is recommended
 * only when the PRD's text matches it, and names the features (F-n) whose own text matches; tools without one apply
 * to every PRD.
 */
export function recommendToolkit(spec: Pick<Spec, 'summary' | 'features' | 'requirements' | 'screens'>): Recommendation[] {
  const whole = [spec.summary, ...spec.requirements.map((row) => `${row.title} ${row.detail}`), ...spec.features.map((row) => `${row.title} ${row.detail}`), ...spec.screens.map((row) => `${row.name} ${row.does ?? ''}`)].join('\n');
  const order: ToolStage[] = ['build', 'before-deploy', 'after-deploy'];
  return TOOLKIT.flatMap((tool) => {
    if (!tool.when) return [{ tool, features: [] }];
    if (!tool.when.test(whole)) return [];
    return [{ tool, features: spec.features.filter((row) => tool.when!.test(`${row.title} ${row.detail}`)).map((row) => row.id) }];
  }).sort((a, b) => order.indexOf(a.tool.stage) - order.indexOf(b.tool.stage));
}

const STAGE_LABEL: Record<ToolStage, [string, string]> = { build: ['만들 때', 'While building'], 'before-deploy': ['배포 전 점검', 'Before deploy'], 'after-deploy': ['배포 후 점검', 'After deploy'] };

/** The toolkit as Markdown, for the PRD document (lang) or the agent brief (English, with an instruction). */
export function renderToolkit(recommendations: Recommendation[], lang: 'ko' | 'en', forAgent = false) {
  if (!recommendations.length) return '';
  const en = lang === 'en' || forAgent;
  const groups = (['build', 'before-deploy', 'after-deploy'] as ToolStage[]).flatMap((stage) => {
    const rows = recommendations.filter((row) => row.tool.stage === stage);
    if (!rows.length) return [];
    const lines = rows.map(({ tool, features }) => `- ${forAgent && tool.kind === 'check' ? '[ ] ' : ''}[${tool.name}](${tool.url}): ${en ? tool.why[1] : tool.why[0]}${features.length ? ` (${features.join(', ')})` : ''}`);
    return [`### ${en ? STAGE_LABEL[stage][1] : STAGE_LABEL[stage][0]}\n${lines.join('\n')}`];
  });
  const title = forAgent ? '## Tools and checks' : `## ${lang === 'en' ? 'Recommended tools and checks' : '추천 도구와 점검'}`;
  const note = forAgent
    ? 'Suggestions from a reviewed list, matched to this PRD by its words. Ask the user before adding a dependency; run every check before calling a P0 feature done.'
    : lang === 'en' ? 'From a reviewed list, matched by the words in this PRD. Nothing is installed for you.' : '검토한 목록에서 이 PRD의 내용에 맞는 것만 골랐습니다. 자동으로 설치하지 않습니다.';
  return `${title}\n${note}\n\n${groups.join('\n\n')}\n\n`;
}
