import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The service key skips row-level security, so a mistake with it can show one user's data to another. Only the files
// below may import it: public data, batch jobs, and server code that checks the user itself. Adding a file here is a
// review decision (escape [ ] in route folders as \\[ \\]); prefer the user's own client (lib/supabase/server) whenever row-level security can do the check.
const SERVICE_KEY_FILES = [
  // The data layer and batch collection; app/ and components/ reach the database through these. The only app/ files
  // left are admin tools, which check the admin first.
  "lib/db/**",
  "lib/ingest/**",
  "lib/mcp/endpoint.ts",
  "app/actions/opportunity-digest.ts",
  "app/actions/prd-models.ts",
  "app/admin/ingest/page.tsx",
  "instrumentation.ts",
  "lib/data-admin.ts",
  "lib/engagement.ts",
  "lib/opportunities/data.ts",
  "lib/personal.ts",
  "scripts/check-app-errors.ts",
  "scripts/export-snapshot.ts",
  "scripts/reembed.ts",
];

export default defineConfig([
  globalIgnores([".next/**", ".open-next/**", ".vercel/**", "node_modules/**", "쌀먹/**", ".claude/**"]),
  {
    extends: [...next],
  },
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    ignores: SERVICE_KEY_FILES,
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/supabase/admin"], message: "The service key skips row-level security. Use lib/supabase/server, or add this file to SERVICE_KEY_FILES in eslint.config.mjs after review." }] }],
    },
  },
  {
    // Model providers are called from lib/llm.ts only, so timeouts, fallbacks and the free-model policy live in one place.
    files: ["**/*.{ts,tsx,js,mjs}"],
    ignores: ["lib/llm.ts", "eslint.config.mjs"],
    rules: {
      "no-restricted-syntax": ["error",
        { selector: "Literal[value=/openrouter\\.ai|api\\.exaone\\.ai/]", message: "Call models through lib/llm.ts instead of a provider URL." },
        { selector: "TemplateElement[value.raw=/openrouter\\.ai|api\\.exaone\\.ai/]", message: "Call models through lib/llm.ts instead of a provider URL." },
      ],
    },
  },
  {
    // Pages, routes and components reach the database through lib/db (and lib/opportunities, lib/ingest), so every
    // query and every use of the service key can be reviewed in one place. Flat config replaces, not merges, a rule
    // for overlapping files, so the provider-URL selectors are repeated here.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error",
        { selector: "CallExpression[callee.property.name='from'][callee.object.name!=/^(Array|Buffer|Uint8Array|Object)$/][arguments.0.type='Literal']", message: "Query the database through a lib/db function, not .from() in app/ or components/." },
        { selector: "Literal[value=/openrouter\\.ai|api\\.exaone\\.ai/]", message: "Call models through lib/llm.ts instead of a provider URL." },
        { selector: "TemplateElement[value.raw=/openrouter\\.ai|api\\.exaone\\.ai/]", message: "Call models through lib/llm.ts instead of a provider URL." },
      ],
    },
  },
]);
