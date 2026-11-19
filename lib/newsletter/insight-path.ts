export function parseInsightPath(value: string | string[] | undefined): 'new' | 'project' {
  return value === 'project' ? 'project' : 'new';
}
