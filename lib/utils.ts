/** Runs `run` over items with at most `limit` in flight, starting them in order. */
export async function inBatches<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

function projectSubject(value: string) {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function cleanProjectTitle(title: string) {
  const normalized = projectSubject(title);
  const cloneMatch = normalized.match(/^(.+?)(?:을|를) 참고한 미니 클론 만들기(?: 기반 미니 프로젝트)?$/);
  if (cloneMatch?.[1]) {
    return `${projectSubject(cloneMatch[1])}처럼 핵심 기능 만들어보기`;
  }

  const basedMatch = normalized.match(/^(.+?) 기반 미니 프로젝트$/);
  if (basedMatch?.[1]) {
    return `${projectSubject(basedMatch[1])}로 시작하는 실전 미니 프로젝트`;
  }

  return normalized;
}
