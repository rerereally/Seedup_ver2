// "Environment first" (docs/supervisor-plan.md 2-2 ①): the things only a person can do before agents build — accounts,
// keys, deploy targets, open decisions — pulled from the PRD so they come first, while the agent builds against mocks.
// Only key NAMES are suggested here; values stay in the user's .env and never reach Seedup.
import type { Spec } from '../opportunities/spec';
import type { HumanTask } from './types';

type Service = {
  match: RegExp;
  title: string;
  category: HumanTask['category'];
  envVars: string[];
  minutes: number;
  steps: string[];
  mock: string;
};

// Conventional key names for services PRDs name often. A name only suggests; the project's own code decides.
const SERVICES: Service[] = [
  { match: /supabase/i, title: 'Supabase 프로젝트 만들기', category: 'database', envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY'], minutes: 10, steps: ['supabase.com에서 새 프로젝트를 만듭니다.', 'Project Settings > API에서 주소와 키를 .env에 넣습니다.'], mock: 'DB 호출은 메모리 저장소로 대신하고 같은 함수 모양을 지킵니다.' },
  { match: /stripe/i, title: 'Stripe 테스트 키 받기', category: 'payment', envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], minutes: 15, steps: ['Stripe 대시보드를 테스트 모드로 둡니다.', 'Developers > API keys에서 테스트 키를 .env에 넣습니다.'], mock: '결제는 항상 성공하는 가짜 응답과 웹훅 이벤트로 대신합니다.' },
  { match: /토스|toss/i, title: '토스페이먼츠 테스트 키 받기', category: 'payment', envVars: ['TOSS_CLIENT_KEY', 'TOSS_SECRET_KEY'], minutes: 15, steps: ['토스페이먼츠 개발자센터에서 테스트 키를 확인합니다.', '.env에 넣습니다.'], mock: '결제 승인은 가짜 성공 응답으로 대신합니다.' },
  { match: /openai|gpt-?\d/i, title: 'OpenAI API 키 받기', category: 'api_key', envVars: ['OPENAI_API_KEY'], minutes: 5, steps: ['OpenAI 대시보드의 API keys에서 키를 만듭니다.', '.env에 넣고 사용 한도를 정합니다.'], mock: '모델 응답은 고정 문장으로 대신합니다.' },
  { match: /anthropic|claude api/i, title: 'Anthropic API 키 받기', category: 'api_key', envVars: ['ANTHROPIC_API_KEY'], minutes: 5, steps: ['Anthropic 콘솔의 API Keys에서 키를 만듭니다.', '.env에 넣고 사용 한도를 정합니다.'], mock: '모델 응답은 고정 문장으로 대신합니다.' },
  { match: /openrouter/i, title: 'OpenRouter API 키 받기', category: 'api_key', envVars: ['OPENROUTER_API_KEY'], minutes: 5, steps: ['OpenRouter 설정의 Keys에서 키를 만듭니다.', '.env에 넣습니다.'], mock: '모델 응답은 고정 문장으로 대신합니다.' },
  { match: /resend/i, title: 'Resend 메일 키 받기', category: 'api_key', envVars: ['RESEND_API_KEY'], minutes: 10, steps: ['resend.com에서 키를 만들고 보내는 도메인을 확인합니다.', '.env에 넣습니다.'], mock: '메일은 보내지 않고 내용을 로그로 남깁니다.' },
  { match: /github (oauth|로그인|login)|깃허브 로그인/i, title: 'GitHub OAuth 앱 만들기', category: 'auth', envVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'], minutes: 10, steps: ['GitHub Settings > Developer settings > OAuth Apps에서 앱을 만듭니다.', '콜백 주소를 넣고 ID와 비밀값을 .env에 넣습니다.'], mock: '로그인은 고정 테스트 사용자로 대신합니다.' },
  { match: /google (oauth|로그인|login)|구글 로그인/i, title: 'Google OAuth 클라이언트 만들기', category: 'auth', envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], minutes: 15, steps: ['Google Cloud Console에서 OAuth 클라이언트를 만듭니다.', '승인된 리디렉션 주소를 넣고 값을 .env에 넣습니다.'], mock: '로그인은 고정 테스트 사용자로 대신합니다.' },
  { match: /vercel|cloudflare|배포|deploy/i, title: '배포 대상 연결하기', category: 'deploy', envVars: [], minutes: 15, steps: ['배포할 곳(Vercel, Cloudflare 등)에 계정을 만들고 저장소를 연결합니다.', '.env의 키를 배포 환경 변수에도 넣습니다.'], mock: '배포 전까지는 로컬 실행으로 확인합니다.' },
];

// A login need with no named provider still needs a person to pick and set one up.
const LOGIN = /로그인|회원가입|sign[ -]?in|sign[ -]?up|log[ -]?in|auth/i;

const featureText = (feature: Spec['features'][number]) => [
  feature.title, feature.detail,
  ...(feature.slots ? [...feature.slots.access, ...feature.slots.data, ...feature.slots.inputs] : []),
].join(' ');

/**
 * Person-only setup tasks for a PRD, most features unblocked first, then the open decisions the PRD left. Each task says
 * which features it unblocks and how an agent mocks it meanwhile, so building does not wait on the person.
 */
export function humanTasks(spec: Spec): HumanTask[] {
  const design = spec.technicalDesign;
  const specWide = [design?.architecture ?? '', ...(design?.stack ?? []), ...(design?.interfaces ?? []), ...(design?.dataModel ?? [])].join(' ');
  const services = SERVICES.flatMap((service) => {
    const features = spec.features.filter((row) => service.match.test(featureText(row))).map((row) => row.id);
    return features.length || service.match.test(specWide) ? [{ service, features }] : [];
  });
  if (!services.some(({ service }) => service.category === 'auth')) {
    const features = spec.features.filter((row) => LOGIN.test(featureText(row))).map((row) => row.id);
    if (features.length) services.push({ service: { match: LOGIN, title: '로그인 방식 정하고 설정하기', category: 'auth', envVars: [], minutes: 20, steps: ['로그인 방식(이메일, GitHub, Google 등)을 정합니다.', '고른 서비스에서 앱을 만들고 키 이름을 에이전트에게 알려 줍니다.'], mock: '로그인은 고정 테스트 사용자로 대신합니다.' }, features });
  }
  const setup = services
    .sort((a, b) => b.features.length - a.features.length)
    .map(({ service, features }) => ({
      title: service.title, category: service.category, envVars: service.envVars, estimatedMinutes: service.minutes,
      guideSteps: service.steps, unblocksFeatureIds: features, mockContractHint: service.mock,
    }));
  const decisions = (spec.openQuestions ?? []).slice(0, 5).map((question) => ({
    title: question, category: 'decision' as const, envVars: [], estimatedMinutes: 5,
    guideSteps: ['정한 내용을 에이전트에게 알려 주면 결정 기록(record_decision)에 남깁니다.'], unblocksFeatureIds: [],
    mockContractHint: '정하기 전까지는 가장 단순한 쪽으로 만들고 바꾸기 쉽게 둡니다.',
  }));
  return [...setup, ...decisions].map((task, index) => ({ id: `H-${index + 1}`, ...task, done: false }));
}
