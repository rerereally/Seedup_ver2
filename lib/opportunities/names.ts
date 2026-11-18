// Names come from a free model that often writes "gif 검색 api 대안". Fixing the casing here, deterministically, keeps
// every page, mail and PRD consistent without another model call or a rerun of the engine.
const ACRONYMS = ['api', 'gif', 'llm', 'ai', 'cli', 'sdk', 'ui', 'ux', 'db', 'sql', 'mcp', 'rag', 'pdf', 'url', 'json', 'css', 'html', 'ssh', 'jwt', 'ci', 'cd', 'ide', 'ocr', 'tts', 'stt', 'gpu', 'cpu', 'vm', 'k8s', 'saas', 'csv', 'yaml', 'http', 'mvp'];
const SPECIAL: Record<string, string> = { ios: 'iOS', github: 'GitHub', oauth: 'OAuth', saas: 'SaaS', k8s: 'K8s', latex: 'LaTeX', javascript: 'JavaScript', typescript: 'TypeScript', postgres: 'Postgres', openai: 'OpenAI' };
// Known mistranslations of technical terms, from reviewed engine output.
const TERMS: Array<[RegExp, string]> = [[/브레프/g, 'B-rep'], [/라텍스/g, 'LaTeX']];

export function tidyName(name: string) {
  let text = name.trim();
  for (const [pattern, replacement] of TERMS) text = text.replace(pattern, replacement);
  return text.replace(/\b[a-z][a-z0-9]{1,9}\b/g, (word) => SPECIAL[word] ?? (ACRONYMS.includes(word) ? word.toUpperCase() : word));
}
