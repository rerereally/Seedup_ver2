// From an admin environment: npx tsx --env-file=.env scripts/section-usage.ts
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { getContentTable, type ContentTarget } from '../lib/content-targets';
import { SECTIONS, type Section } from '../lib/sections';

const DAY = 86_400_000;
const PAGE_SIZE = 1000;
const CONTENT: Partial<Record<Section, ContentTarget>> = {
  articles: 'news',
  papers: 'paper',
  'github-trends': 'github',
  projects: 'project',
  'ai-products': 'ai_product',
};
const SOURCES: Partial<Record<Section, string[]>> = {
  insights: ['opportunity-engine'],
  articles: ['rss', 'article-drafts'],
  papers: ['research'],
  trends: ['trends', 'external-trends', 'model-intelligence'],
  'github-trends': ['github'],
  'ai-products': ['products'],
  projects: ['project-ideas'],
  predictions: ['opportunity-engine'],
};

type Dated = { created_at: string };
type SectionView = Dated & { section: string; user_id: string | null };
type PrdRun = Dated & { user_id: string | null; ok: boolean; kind: string };
type IngestRun = Dated & { source: string; status: string; duration_ms: number };
type UsageRows = {
  firstViewAt: string | null;
  views: SectionView[];
  prdRuns: PrdRun[];
  ingestRuns: IngestRun[];
  legacyViews: Partial<Record<Section, number>>;
};

export function sectionUsageReport({ firstViewAt, views, prdRuns, ingestRuns, legacyViews }: UsageRows, now: number) {
  const since = (days: number) => now - days * DAY;
  const recentViews = views.map((view) => ({ ...view, time: Date.parse(view.created_at) }))
    .filter(({ time }) => time >= since(28) && time <= now);
  const recentIngest = ingestRuns.filter(({ created_at }) => {
    const time = Date.parse(created_at);
    return time >= since(14) && time <= now;
  });
  const successes = new Map<string, number[]>();
  for (const run of prdRuns) {
    const time = Date.parse(run.created_at);
    if (!run.ok || run.kind !== 'prd' || !run.user_id || time < since(28) || time > now) continue;
    const times = successes.get(run.user_id) ?? [];
    times.push(time);
    successes.set(run.user_id, times);
  }

  const lines = [];
  if (!firstViewAt || Date.parse(firstViewAt) > since(7)) lines.push('기록이 아직 짧습니다.', '');
  lines.push(
    '| 섹션 | 7일 조회 | 28일 조회 | 7일 로그인 사용자 | 28일 로그인 사용자 | PRD로 이어진 비율 (28일) | 기존 상세 누적 조회 | 수집 평균 시간 (14일, 초) | 수집 실패 (14일) |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const section of SECTIONS) {
    const visits = recentViews.filter((view) => view.section === section);
    const users7 = new Set<string>();
    const users28 = new Set<string>();
    const converted = new Set<string>();
    let views7 = 0;
    for (const { time, user_id: userId } of visits) {
      if (time >= since(7)) views7++;
      if (!userId) continue;
      users28.add(userId);
      if (time >= since(7)) users7.add(userId);
      if (!converted.has(userId) && successes.get(userId)?.some((run) => run >= time && run <= time + 7 * DAY)) converted.add(userId);
    }
    // Recent visits are counted with the conversion evidence available at the report time.
    const conversion = users28.size ? `${(100 * converted.size / users28.size).toFixed(1)}% (${converted.size}/${users28.size})` : '—';
    const sources = SOURCES[section];
    const runs = recentIngest.filter((run) => sources?.includes(run.source));
    const duration = runs.length ? (runs.reduce((sum, run) => sum + run.duration_ms, 0) / runs.length / 1000).toFixed(1) : '—';
    const failures = sources ? runs.filter((run) => run.status === 'failed').length : '—';
    lines.push(`| ${section} | ${views7} | ${visits.length} | ${users7.size} | ${users28.size} | ${conversion} | ${legacyViews[section] ?? '—'} | ${duration} | ${failures} |`);
  }
  return lines.join('\n');
}

async function readAll<T>(table: string, fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  const service = createClient(url, key, { auth: { persistSession: false } });
  const now = Date.now();
  const until = new Date(now).toISOString();
  const since = (days: number) => new Date(now - days * DAY).toISOString();
  const first = await service.from('section_views').select('created_at').lte('created_at', until).order('created_at').limit(1).maybeSingle();
  if (first.error && !['42P01', 'PGRST205'].includes(first.error.code)) throw new Error(`section_views: ${first.error.message}`);
  const firstViewAt = first.data?.created_at ?? null;

  const [views, prdRuns, ingestRuns, legacyEntries] = await Promise.all([
    firstViewAt ? readAll<SectionView>('section_views', (from, to) => service.from('section_views')
      .select('section,user_id,created_at').gte('created_at', since(28)).lte('created_at', until)
      .order('created_at').order('id').range(from, to)) : [],
    readAll<PrdRun>('prd_runs', (from, to) => service.from('prd_runs')
      .select('user_id,created_at,ok,kind').gte('created_at', since(28)).lte('created_at', until)
      .order('created_at').order('id').range(from, to)),
    readAll<IngestRun>('ingest_runs', (from, to) => service.from('ingest_runs')
      .select('source,status,duration_ms,created_at').gte('created_at', since(14)).lte('created_at', until)
      .order('created_at').order('id').range(from, to)),
    Promise.all(Object.entries(CONTENT).map(async ([section, target]) => {
      const table = getContentTable(target);
      const rows = await readAll<{ view_count: number }>(table, (from, to) => service.from(table).select('view_count').order('id').range(from, to));
      return [section, rows.reduce((sum, row) => sum + row.view_count, 0)] as const;
    })),
  ]);
  console.log(sectionUsageReport({ firstViewAt, views, prdRuns, ingestRuns, legacyViews: Object.fromEntries(legacyEntries) }, now));
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
