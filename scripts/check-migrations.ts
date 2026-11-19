// Checks supabase/migrations before it reaches the database: every file is named <14-digit version>_<name>.sql with
// versions in increasing order, the schema check can read each one, and lib/schema-manifest.json (what the admin page
// and scripts/check-schema.ts compare with the live database) matches the SQL. After adding a migration:
//   npx tsx scripts/check-migrations.ts --write
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { schemaFromMigrations } from '../lib/schema-check';

const DIR = join(__dirname, '..', 'supabase', 'migrations');
const MANIFEST = join(__dirname, '..', 'lib', 'schema-manifest.json');

/** The migration files in order, with their SQL; throws on a badly named or out-of-order file. */
export function readMigrations(dir = DIR) {
  const files = readdirSync(dir).sort();
  const errors: string[] = [];
  let previous = '';
  for (const file of files) {
    const version = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1];
    if (!version) errors.push(`${file}: name must be <YYYYMMDDHHMMSS>_<lowercase_name>.sql`);
    else if (version === previous) errors.push(`${file}: version ${version} is used twice`);
    else previous = version;
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return files.map((file) => ({ file, sql: readFileSync(join(dir, file), 'utf8') }));
}

function main() {
  const manifest = `${JSON.stringify(schemaFromMigrations(readMigrations()), null, 2)}\n`;
  if (process.argv.includes('--write')) {
    writeFileSync(MANIFEST, manifest);
    console.log('wrote lib/schema-manifest.json');
  } else if (readFileSync(MANIFEST, 'utf8') !== manifest) {
    console.log('::error::lib/schema-manifest.json does not match supabase/migrations. Run: npx tsx scripts/check-migrations.ts --write');
    process.exitCode = 1;
  } else {
    console.log('migrations: names, order and schema manifest are fine');
  }
}

if (require.main === module) main();
