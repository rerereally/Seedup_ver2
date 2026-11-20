import { csvCell } from '../csv';
import { translator } from '../i18n';
import type { Lang } from '../i18n';
import type { Priority, Spec, SpecFeature, SpecInput } from './spec';

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];
const LINEAR_PRIORITY = { P0: 'Urgent', P1: 'High', P2: 'Medium' };
const URL_LIMIT = 6000;

export type FeatureIssue = { title: string; body: string; priority?: Priority; shareUrl?: string };

export function featureIssue(input: SpecInput, spec: Spec, feature: SpecFeature, lang: Lang, shareUrl?: string): FeatureIssue {
  const t = translator(lang);
  const requirements = [...spec.requirements, ...spec.hypotheses].filter((row) => feature.requirementIds.includes(row.id));
  const priority = PRIORITIES.find((level) => requirements.some((row) => row.priority === level));
  const acceptance = requirements.flatMap((row) => (row.acceptance ?? []).map((line) => `- [ ] ${line} (${row.id})`));
  const sources = [...new Set(requirements.flatMap((row) => row.evidence))].flatMap((n) => {
    const url = input.evidence[n - 1]?.url;
    if (!url || !/^https?:\/\//i.test(url) || !URL.canParse(url)) return [];
    return [`- E-${n} <${new URL(url).href}>`];
  });

  return {
    title: `${feature.id} ${feature.title}`,
    priority,
    shareUrl,
    body: [
      priority && `**${t('우선순위', 'Priority')}** ${priority}`,
      feature.detail,
      requirements.length && `## ${t('관련 요구사항', 'Related requirements')}\n${requirements.map((row) => `- ${row.id}${row.priority ? ` [${row.priority}]` : ''} ${row.title}`).join('\n')}`,
      acceptance.length && `## ${t('수락 기준', 'Acceptance criteria')}\n${acceptance.join('\n')}`,
      sources.length && `## ${t('근거 원문', 'Source quotes')}\n${sources.join('\n')}`,
      shareUrl && `[${t('전체는 Seedup에서', 'Full PRD on Seedup')}](${shareUrl})`,
    ].filter(Boolean).join('\n\n'),
  };
}

export function githubRepo(value: string) {
  const repo = value.trim();
  const [owner, name] = repo.split('/');
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d_.-]{1,100}$/i.test(repo)
    && !owner.includes('--') && name !== '.' && name !== '..' ? repo : null;
}

export function issueUrl(issue: FeatureIssue, target: 'github' | 'linear', lang: Lang, repo?: string, githubLabels = false) {
  const repository = target === 'github' ? githubRepo(repo ?? '') : null;
  if (target === 'github' && !repository) return null;
  const base = repository ? `https://github.com/${repository}/issues/new` : 'https://linear.new';
  const params = new URLSearchParams({ title: issue.title });
  const bodyKey = repository ? 'body' : 'description';
  if (issue.priority) {
    if (!repository) params.set('priority', LINEAR_PRIORITY[issue.priority].toLowerCase());
    else if (githubLabels) params.set('labels', issue.priority);
  }
  const urlWith = (body: string) => {
    params.set(bodyKey, body);
    return `${base}?${params}`;
  };
  const full = urlWith(issue.body);
  if (full.length <= URL_LIMIT) return full;

  const t = translator(lang);
  const tail = issue.shareUrl
    ? `[${t('전체는 Seedup에서', 'Full PRD on Seedup')}](${issue.shareUrl})`
    : t('전체 PRD는 Seedup에서 확인하세요.', 'See the full PRD in Seedup.');
  const characters = Array.from(issue.body);
  let low = 0;
  let high = Math.min(characters.length, URL_LIMIT);
  if (urlWith(tail).length > URL_LIMIT) return null;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (urlWith(`${characters.slice(0, middle).join('')}…\n\n${tail}`).length <= URL_LIMIT) low = middle;
    else high = middle - 1;
  }
  return urlWith(low ? `${characters.slice(0, low).join('').trimEnd()}…\n\n${tail}` : tail);
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function githubIssueCommands(repo: string, issues: FeatureIssue[]) {
  const repository = githubRepo(repo);
  if (!repository) return null;
  return [...issues].sort((a, b) => Number(b.priority === 'P0') - Number(a.priority === 'P0')).map((issue) => {
    const lines = new Set(issue.body.split(/\r?\n|\r/));
    let delimiter = 'SEEDUP_ISSUE';
    while (lines.has(delimiter)) delimiter += '_';
    return `gh issue create --repo ${shellQuote(repository)} --title ${shellQuote(issue.title)} --body-file - <<'${delimiter}'\n${issue.body}\n${delimiter}`;
  }).join('\n\n');
}

export function issuesCsv(issues: FeatureIssue[], target: 'jira' | 'linear') {
  const header = `${target === 'jira' ? 'Summary' : 'Title'},Description,Priority,Labels`;
  const rows = issues.map(({ title, body, priority }) => [
    title, body, priority && target === 'linear' ? LINEAR_PRIORITY[priority] : priority ?? '', priority ?? '',
  ].map(csvCell).join(','));
  return [header, ...rows].join('\r\n');
}
