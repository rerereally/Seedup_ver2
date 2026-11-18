/**
 * The database changes that live in hand-run SQL files under supabase/. Forgetting one breaks a feature quietly in
 * production, so this lists what each file adds and checks it against the live database's API description.
 */
export const SCHEMA_FILES: Array<{ file: string; tables?: string[]; columns?: Array<[string, string]>; functions?: string[] }> = [
  { file: 'opportunities_2026_11.sql', tables: ['opportunities', 'opportunity_history', 'evidence_dossiers', 'ai_usage'], functions: ['consume_ai_usage'] },
  { file: 'mcp_tokens_2026_11.sql', tables: ['mcp_tokens'] },
  { file: 'prd_models_2026_11.sql', tables: ['app_settings', 'prd_runs'] },
  { file: 'prd_cache_2026_11.sql', tables: ['prd_cache'] },
  { file: 'build_progress_2026_11.sql', tables: ['build_progress'] },
  { file: 'newsletter_issues_2026_11.sql', tables: ['newsletter_issues'] },
  { file: 'newsletter_sends_2026_11.sql', tables: ['newsletter_sends'] },
  { file: 'dossier_share_2026_11.sql', columns: [['evidence_dossiers', 'shared']] },
  { file: 'usage_refund_2026_11.sql', functions: ['release_ai_usage'] },
  { file: 'view_count_2026_11.sql', functions: ['increment_content_view'] },
  { file: 'saved_quotes_2026_11.sql', tables: ['saved_quotes'] },
  { file: 'idea_watches_2026_11.sql', tables: ['idea_watches'] },
  { file: 'built_2026_11.sql', columns: [['evidence_dossiers', 'built_url'], ['evidence_dossiers', 'built_at']] },
  { file: 'repo_releases_2026_11.sql', columns: [['github_trends', 'latest_release']] },
];

export type ApiSpec = { paths?: Record<string, unknown>; definitions?: Record<string, { properties?: Record<string, unknown> }> };

/** The files whose tables, columns or functions the database does not have yet, with what is missing. */
export function missingSchema(spec: ApiSpec, files = SCHEMA_FILES) {
  const paths = spec.paths ?? {};
  const definitions = spec.definitions ?? {};
  return files.flatMap(({ file, tables = [], columns = [], functions = [] }) => {
    const missing = [
      ...tables.filter((table) => !(`/${table}` in paths)),
      ...columns.filter(([table, column]) => !(column in (definitions[table]?.properties ?? {}))).map(([table, column]) => `${table}.${column}`),
      ...functions.filter((name) => !(`/rpc/${name}` in paths)).map((name) => `${name}()`),
    ];
    return missing.length ? [{ file, missing }] : [];
  });
}

/** The live database's REST description (PostgREST OpenAPI), read with the server key. Null when it cannot be read. */
export async function readApiSpec(): Promise<ApiSpec | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, accept: 'application/openapi+json' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    return response.ok ? ((await response.json()) as ApiSpec) : null;
  } catch {
    return null;
  }
}
