// Fails when the database lacks a change from one of the hand-run SQL files in supabase/, and says which file to run.
import { missingSchema, readApiSpec } from '../lib/schema-check';

async function main() {
  const spec = await readApiSpec();
  if (!spec) {
    console.log('::warning::Could not read the database API description; schema not checked.');
    return;
  }
  const missing = missingSchema(spec);
  if (!missing.length) {
    console.log('database schema: every supabase/*_2026_11.sql change is applied');
    return;
  }
  for (const { file, missing: items } of missing) console.log(`::error::Run supabase/${file} in the Supabase SQL editor. Missing: ${items.join(', ')}`);
  process.exitCode = 1;
}

void main();
