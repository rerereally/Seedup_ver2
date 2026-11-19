import manifest from './schema-manifest.json';

/**
 * What each migration in supabase/migrations adds (tables, columns, functions), read from the SQL itself and checked
 * against the live database's API description, so a migration that was never applied is named instead of breaking a
 * feature quietly. The Worker cannot read files, so the parsed result is kept in schema-manifest.json, which
 * scripts/check-migrations.ts rewrites (--write) and CI keeps in step with the SQL.
 */
export type SchemaFile = { file: string; tables?: string[]; columns?: Array<[string, string]>; functions?: string[] };

export const SCHEMA_FILES = manifest as SchemaFile[];

// Other schemas (auth, storage) are Supabase's own: "auth.users" does not match, as NAME must be followed by a space or "(".
const NAME = String.raw`(?:public\.)?"?([a-z_][a-z0-9_]*)"?`;
const NOT_COLUMN = /^(constraint|primary|unique|foreign|check|exclude|like)\b/;

/** Splits on commas that are not inside parentheses. */
function topLevel(text: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    else if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, text.slice(start)].map((part) => part.trim()).filter(Boolean);
}

/** The body between the parenthesis at `open` and its match. */
function parenthesized(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return null;
}

type Change = { kind: 'table' | 'column' | 'function'; name: string; drop?: boolean };

/** The public tables, columns and functions one migration creates or drops, in order. Throws on SQL it cannot read. */
export function parseMigration(sql: string): Change[] {
  // One pass, so a quote inside a comment or "--" inside a string or function body is not misread.
  const text = sql.replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$|'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//gi, (token) => (token.startsWith('-') || token.startsWith('/') ? ' ' : "''")).toLowerCase();
  if (/\$[a-z_]*\$/.test(text)) throw new Error('unclosed $$ quote');
  const changes: Change[] = [];
  for (const statement of text.split(';').map((part) => part.replace(/\s+/g, ' ').trim())) {
    let match: RegExpMatchArray | null;
    if ((match = statement.match(new RegExp(`^create (?:unlogged )?table (?:if not exists )?${NAME} ?\\(`)))) {
      const body = parenthesized(statement, statement.indexOf('('));
      if (body === null) throw new Error(`unbalanced parentheses in create table ${match[1]}`);
      changes.push({ kind: 'table', name: match[1] });
      for (const item of topLevel(body)) if (!NOT_COLUMN.test(item)) changes.push({ kind: 'column', name: `${match[1]}.${item.split(' ')[0].replace(/"/g, '')}` });
    } else if ((match = statement.match(new RegExp(`^create (?:or replace )?(?:materialized )?view (?:if not exists )?${NAME} `)))) {
      changes.push({ kind: 'table', name: match[1] });
    } else if ((match = statement.match(new RegExp(`^create (?:or replace )?function ${NAME} ?\\(`)))) {
      // Trigger functions cannot be called over the API, so the API description does not list them.
      if (!/\) returns trigger\b/.test(statement)) changes.push({ kind: 'function', name: match[1] });
    } else if ((match = statement.match(new RegExp(`^alter table (?:if exists )?(?:only )?${NAME} (.*)$`)))) {
      const table = match[1];
      // shortcut: renames are not followed; write a drop and an add (or update the manifest by hand) if one is ever needed.
      if (/^rename\b/.test(match[2])) throw new Error(`alter table ${table} rename is not supported by the schema check`);
      for (const clause of topLevel(match[2])) {
        const add = clause.match(/^add (?:column )?(?:if not exists )?"?([a-z_][a-z0-9_]*)"?/);
        const drop = clause.match(/^drop (?:column )?(?:if exists )?"?([a-z_][a-z0-9_]*)"?/);
        if (add && !NOT_COLUMN.test(add[1])) changes.push({ kind: 'column', name: `${table}.${add[1]}` });
        else if (drop && !NOT_COLUMN.test(drop[1])) changes.push({ kind: 'column', name: `${table}.${drop[1]}`, drop: true });
      }
    } else if ((match = statement.match(/^drop (table|view|materialized view|function) (?:if exists )?(.*)$/))) {
      const kind = match[1] === 'function' ? 'function' : 'table';
      for (const target of topLevel(match[2].replace(/ (cascade|restrict)$/, ''))) {
        const name = target.match(new RegExp(`^${NAME}`))?.[1];
        if (name) changes.push({ kind, name, drop: true });
      }
    }
  }
  return changes;
}

/** Folds migrations (in file order) into what each file adds that still exists after the later ones. */
export function schemaFromMigrations(migrations: Array<{ file: string; sql: string }>): SchemaFile[] {
  const owner = new Map<string, string>(); // "kind:name" -> file that first added it
  for (const { file, sql } of migrations) {
    for (const change of parseMigration(sql)) {
      const key = `${change.kind}:${change.name}`;
      if (change.drop) {
        owner.delete(key);
        if (change.kind === 'table') for (const other of [...owner.keys()]) if (other.startsWith(`column:${change.name}.`)) owner.delete(other);
      } else if (!owner.has(key)) owner.set(key, file);
    }
  }
  return migrations.flatMap(({ file }) => {
    const keys = [...owner].filter(([, owned]) => owned === file).map(([key]) => key);
    const of = (kind: string) => keys.filter((key) => key.startsWith(`${kind}:`)).map((key) => key.slice(kind.length + 1));
    const entry: SchemaFile = { file };
    if (of('table').length) entry.tables = of('table');
    if (of('column').length) entry.columns = of('column').map((name) => name.split('.') as [string, string]);
    if (of('function').length) entry.functions = of('function');
    return keys.length ? [entry] : [];
  });
}

export type ApiSpec = { paths?: Record<string, unknown>; definitions?: Record<string, { properties?: Record<string, unknown> }> };

/** The files whose tables, columns or functions the database does not have yet, with what is missing. */
export function missingSchema(spec: ApiSpec, files = SCHEMA_FILES) {
  const paths = spec.paths ?? {};
  const definitions = spec.definitions ?? {};
  return files.flatMap(({ file, tables = [], columns = [], functions = [] }) => {
    const missing = [
      ...tables.filter((table) => !(`/${table}` in paths)),
      // A missing table is reported once, not once per column.
      ...columns.filter(([table, column]) => `/${table}` in paths && !(column in (definitions[table]?.properties ?? {}))).map(([table, column]) => `${table}.${column}`),
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
