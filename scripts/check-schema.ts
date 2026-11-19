// Fails when the database lacks a table, column or function that a file in supabase/migrations adds, and names the file.
import { missingSchema, readApiSpec, schemaFromMigrations } from '../lib/schema-check';
import { readMigrations } from './check-migrations';

async function main() {
  const spec = await readApiSpec();
  if (!spec) {
    console.log('::warning::Could not read the database API description; schema not checked.');
    return;
  }
  const missing = missingSchema(spec, schemaFromMigrations(readMigrations()));
  if (!missing.length) {
    console.log('database schema: every supabase/migrations change is applied');
    return;
  }
  for (const { file, missing: items } of missing) console.log(`::error::Apply supabase/migrations/${file} (npx supabase db push, or the Supabase SQL editor). Missing: ${items.join(', ')}`);
  process.exitCode = 1;
}

void main();
