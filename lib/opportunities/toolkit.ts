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
  /** A capability or technology in the PRD that gives this tool a role. */
  when: RegExp;
  javascript?: true;
};

const WEB = /웹\s*(?:앱|서비스|사이트|페이지|대시보드|브라우저|기반)|브라우저|\b(?:web[ -](?:app|page|dashboard|ui|interface)|website|browser|React|Next\.js|Vue|Svelte|HTML)\b/i;
const REACT = /\b(?:React|Next\.js|shadcn)\b/i;
const JAVASCRIPT = /\b(?:JavaScript|TypeScript|Node(?:\.js)?|Deno|Bun|React|Next\.js|Vue|Svelte|Express|Hono)\b/i;
const OTHER_RUNTIME = /\b(?:Python|Django|FastAPI|Flask|Ruby|Rails|Rust|Golang|Go|Java|Kotlin|PHP|Laravel|Swift|Dart|Flutter|C#|\.NET)\b/i;
const DEPLOYMENT = /배포|호스팅|운영\s*(?:서버|환경)|공개\s*(?:서비스|URL)|\b(?:deploy(?:s|ed|ing|ment)?|hosting|production\s+(?:service|site|server|environment|url)|Vercel|Netlify|Cloudflare\s+(?:Workers|Pages))\b/i;
const LOCAL_ONLY = /로컬\s*(?:전용|만|에서만)|오프라인\s*전용|서버(?:는|를)?\s*(?:없|두지\s*않)|(?:배포|호스팅)(?:를|을|는)?\s*(?:없이|하지\s*않)|\b(?:local[ -]only|offline[ -]only|(?:no|without)\s+(?:servers?|deploy(?:ment|ing)?|hosting)|(?:do not|don't|never)\s+deploy)\b/i;

export const TOOLKIT: Tool[] = [
  // Build
  { id: 'shadcn-ui', name: 'shadcn/ui', kind: 'library', stage: 'build', repo: 'shadcn-ui/ui', url: 'https://ui.shadcn.com', why: ['접근성을 갖춘 화면 부품을 코드로 복사해 와서 고쳐 쓸 수 있습니다.', 'Accessible UI parts you copy in and own.'], when: REACT },
  { id: 'zod', name: 'Zod', javascript: true, kind: 'library', stage: 'build', repo: 'colinhacks/zod', url: 'https://zod.dev', why: ['입력과 API 요청을 한곳에서 검증합니다.', 'Validates input and API payloads in one place.'], when: /입력\s*검증|스키마\s*검증|요청\s*검증|\b(?:Zod|(?:input|schema|payload|request) validation|validate(?:s|d)? (?:input|schema|payload|request))\b/i },
  { id: 'better-auth', name: 'Better Auth', javascript: true, kind: 'library', stage: 'build', repo: 'better-auth/better-auth', url: 'https://www.better-auth.com', why: ['로그인, 세션, 소셜 로그인을 직접 짜지 않게 해 줍니다.', 'Sign-in, sessions and social login without writing your own.'], when: /로그인|회원가입|세션\s*인증|\b(?:Better Auth|log[ -]?in|sign[ -]?(?:in|up)|OAuth|authentication|user sessions)\b/i },
  { id: 'stripe', name: 'Stripe Node', javascript: true, kind: 'library', stage: 'build', repo: 'stripe/stripe-node', url: 'https://docs.stripe.com', why: ['결제와 구독을 카드 정보를 직접 다루지 않고 붙입니다.', 'Payments and subscriptions without handling card data.'], when: /결제|유료\s*구독|청구|\b(?:Stripe|payments?|billing|checkout|paid subscriptions?)\b/i },
  { id: 'drizzle', name: 'Drizzle ORM', javascript: true, kind: 'library', stage: 'build', repo: 'drizzle-team/drizzle-orm', url: 'https://orm.drizzle.team', why: ['타입이 맞는 SQL과 마이그레이션을 씁니다.', 'Typed SQL and migrations.'], when: /관계형\s*데이터베이스|\b(?:Drizzle|SQL|PostgreSQL|Postgres|MySQL|SQLite|D1)\b/i },
  { id: 'ai-sdk', name: 'AI SDK', javascript: true, kind: 'library', stage: 'build', repo: 'vercel/ai', url: 'https://ai-sdk.dev', why: ['여러 LLM 제공사를 같은 코드로 부르고 스트리밍합니다.', 'Calls and streams many LLM providers with one API.'], when: /\b(?:AI SDK|LLMs?|GPT|Claude(?!\s+Code\b)|(?:OpenAI|Anthropic) (?:API|models?)|(?:generative|agentic) AI|AI[- ](?:powered|generated|assisted|model|chat|assistant|summari\w*))\b|생성형\s*AI|인공지능\s*(?:모델|요약|챗봇|생성)|AI\s*(?:모델|요약|챗봇|생성)|언어\s*모델|모델\s*(?:호출|추론)/i },
  { id: 'mcp-sdk', name: 'MCP TypeScript SDK', javascript: true, kind: 'library', stage: 'build', repo: 'modelcontextprotocol/typescript-sdk', url: 'https://modelcontextprotocol.io', why: ['AI 도구가 읽을 수 있는 MCP 서버를 표준대로 만듭니다.', 'Builds an MCP server AI tools can read, to the standard.'], when: /\b(?:MCP|Model Context Protocol)\b/i },
  { id: 'agent-skills', name: 'Anthropic Agent Skills', kind: 'skill', stage: 'build', repo: 'anthropics/skills', url: 'https://github.com/anthropics/skills', licencePerItem: true, why: ['코딩 에이전트에 붙이는 공개 스킬 모음입니다. 웹앱 테스트, 프런트엔드 디자인 같은 스킬을 골라 쓰고, 스킬마다 라이선스를 확인하세요.', 'Public skills for coding agents, such as web app testing and front-end design. Each skill has its own licence.'], when: /에이전트\s*스킬|\b(?:agent skills?|SKILL\.md)\b/i },
  // Before deploy
  { id: 'playwright', name: 'Playwright', kind: 'check', stage: 'before-deploy', repo: 'microsoft/playwright', url: 'https://playwright.dev', why: ['P0 수락 기준을 실제 브라우저에서 확인하는 테스트를 씁니다.', 'Tests P0 acceptance criteria in a real browser.'], when: WEB },
  { id: 'gitleaks', name: 'Gitleaks', kind: 'check', stage: 'before-deploy', repo: 'gitleaks/gitleaks', url: 'https://gitleaks.io', why: ['API 키나 비밀번호가 코드에 들어갔는지 커밋 전에 찾습니다.', 'Finds API keys and passwords committed to the code.'], when: /API\s*키|시크릿|인증\s*토큰|\b(?:API keys?|secrets?|access tokens?|credentials?)\b/i },
  { id: 'semgrep', name: 'Semgrep', kind: 'check', stage: 'before-deploy', repo: 'semgrep/semgrep', url: 'https://semgrep.dev', why: ['인증 없는 API, 주입 같은 흔한 보안 실수를 코드에서 찾습니다.', 'Finds common security mistakes such as unauthenticated routes and injection.'], when: /인증|로그인|사용자\s*입력\s*검증|\b(?:authentication|OAuth|access control|untrusted input|injection|Semgrep)\b/i },
  { id: 'osv-scanner', name: 'OSV-Scanner', kind: 'check', stage: 'before-deploy', repo: 'google/osv-scanner', url: 'https://google.github.io/osv-scanner', why: ['의존성에 알려진 취약점이 있는지 확인합니다.', 'Checks dependencies for known vulnerabilities.'], when: /외부\s*(?:패키지|라이브러리)|\b(?:npm|pnpm|pip|Cargo|package\.json|lockfile|third-party dependenc\w*)\b/i },
  // After deploy
  { id: 'sentry', name: 'Sentry', javascript: true, kind: 'check', stage: 'after-deploy', repo: 'getsentry/sentry-javascript', url: 'https://docs.sentry.io', why: ['배포 뒤 사용자에게 난 오류를 모아 알려 줍니다.', 'Collects the errors users hit after release.'], when: /오류\s*(?:추적|수집|모니터링)|\b(?:Sentry|(?:error|exception) (?:tracking|monitoring|reporting))\b/i },
  { id: 'lighthouse-ci', name: 'Lighthouse CI', kind: 'check', stage: 'after-deploy', repo: 'GoogleChrome/lighthouse-ci', url: 'https://github.com/GoogleChrome/lighthouse-ci', why: ['배포된 화면의 성능, 접근성 점수가 떨어지면 알립니다.', 'Flags drops in performance and accessibility on the live pages.'], when: WEB },
];

export type Recommendation = { tool: Tool; features: string[] };

/** Recommends tools for the planned capabilities and stack, and production checks when deployment is in scope. */
export function recommendToolkit(spec: Pick<Spec, 'summary' | 'features' | 'requirements' | 'screens' | 'technicalDesign'> & Partial<Pick<Spec, 'nonGoals'>>): Recommendation[] {
  const design = spec.technicalDesign;
  const features = spec.features.map((row) => ({ id: row.id, text: `${row.title} ${row.detail}` }));
  const scope = [
    spec.summary,
    ...features.map((row) => row.text),
    ...spec.requirements.flatMap((row) => [`${row.title} ${row.detail}`, ...(row.acceptance ?? [])]),
    ...spec.screens.map((row) => `${row.name} ${row.does}`),
    ...(design ? [design.architecture, ...design.interfaces, ...design.dataModel, ...design.stack] : []),
  ];
  const deploys = ![...scope, ...(spec.nonGoals ?? [])].some((line) => LOCAL_ONLY.test(line))
    && scope.some((line) => DEPLOYMENT.test(line));

  const stack = design?.stack.join(' ') ?? '';
  const otherStack = OTHER_RUNTIME.test(stack) && !JAVASCRIPT.test(stack);

  return TOOLKIT.flatMap((tool) => {
    if ((tool.javascript && otherStack) || (tool.stage === 'after-deploy' && !deploys) || !scope.some((line) => tool.when.test(line))) return [];
    return [{ tool, features: features.filter((row) => tool.when.test(row.text)).map((row) => row.id) }];
  });
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
    ? 'Suggestions from a reviewed list, matched to this PRD by its words. Ask the user before adding a dependency. Run each check at its listed stage.'
    : lang === 'en' ? 'From a reviewed list, matched by the words in this PRD. Nothing is installed for you.' : '검토한 목록에서 이 PRD의 내용에 맞는 것만 골랐습니다. 자동으로 설치하지 않습니다.';
  return `${title}\n${note}\n\n${groups.join('\n\n')}\n\n`;
}
