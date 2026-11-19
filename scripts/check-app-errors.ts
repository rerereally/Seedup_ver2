// Fails when the site recorded server errors in the last hours (instrumentation.ts writes them), and prints them
// grouped by route and message so the issue the workflow opens says what broke.
//   npx tsx --env-file=.env scripts/check-app-errors.ts [--hours 6]
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const index = process.argv.indexOf('--hours');
  const hours = index >= 0 ? Number(process.argv[index + 1]) || 6 : 6;
  const supabase = createAdminClient();
  if (!supabase) {
    console.log('::warning::No Supabase settings; server errors not checked.');
    return;
  }
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await supabase.from('app_errors').select('path,route,kind,message').gte('created_at', since).limit(500);
  if (error) {
    console.log(`::warning::Server errors not checked (${error.message}). Run supabase/app_errors_2026_11.sql if the table is missing.`);
    return;
  }
  if (!data.length) {
    console.log(`server errors in the last ${hours}h: none`);
    return;
  }
  const groups = new Map<string, { count: number; paths: Set<string> }>();
  for (const row of data) {
    const key = `${row.kind ?? '?'} ${row.route ?? row.path}: ${row.message}`;
    const group = groups.get(key) ?? { count: 0, paths: new Set<string>() };
    group.count += 1;
    group.paths.add(row.path);
    groups.set(key, group);
  }
  console.log(`server errors in the last ${hours}h: ${data.length}`);
  for (const [key, group] of [...groups].sort((a, b) => b[1].count - a[1].count)) console.log(`- ${group.count}x ${key} (${[...group.paths].slice(0, 3).join(', ')})`);
  process.exitCode = 1;
}

void main();
