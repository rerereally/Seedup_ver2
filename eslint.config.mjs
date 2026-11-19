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
  "app/actions/opportunity-digest.ts",
  "app/actions/prd-models.ts",
  "app/actions/product-ratings.ts",
  "app/admin/ingest/page.tsx",
  "app/agents/page.tsx",
  "app/api/ai-products/\\[id\\]/rating/route.ts",
  "app/api/engagement/reaction/route.ts",
  "app/api/ideas/pages/\\[slug\\]/signup/route.ts",
  "app/api/ingest/article-drafts/route.ts",
  "app/api/ingest/embeddings/route.ts",
  "app/api/ingest/external-trends/route.ts",
  "app/api/ingest/github/route.ts",
  "app/api/ingest/model-intelligence/route.ts",
  "app/api/ingest/products/route.ts",
  "app/api/ingest/project-ideas/route.ts",
  "app/api/ingest/research/route.ts",
  "app/api/ingest/rss/route.ts",
  "app/api/ingest/trends/route.ts",
  "app/api/mcp/route.ts",
  "app/api/mcp/token/route.ts",
  "app/api/opportunities/prd/revise/route.ts",
  "app/api/opportunities/prd/route.ts",
  "app/api/opportunities/prd/slots/route.ts",
  "app/api/quotes/route.ts",
  "app/newsletter-preview/\\[period\\]/page.tsx",
  "app/newsletter-preview/page.tsx",
  "app/opportunities/\\[slug\\]/page.tsx",
  "app/page.tsx",
  "app/prd/new/page.tsx",
  "app/prd/page.tsx",
  "app/spec/\\[id\\]/page.tsx",
  "app/try/\\[slug\\]/page.tsx",
  "components/home/HomeDesk.tsx",
  "instrumentation.ts",
  "lib/data-admin.ts",
  "lib/engagement.ts",
  "lib/ingest/rag.ts",
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
]);
