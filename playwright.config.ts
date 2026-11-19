import { defineConfig } from '@playwright/test';

// The core flow in a real browser: idea → tailored questions → streamed PRD → AGENTS.md export. Model answers are
// fixed (LLM_FIXTURES=1, lib/llm-fixtures.ts), so it checks this app's code, not a free model's mood.
// Locally: `npm run build` once, then `npm run e2e`. With E2E_BASE_URL set it tests that running server instead.
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  globalSetup: './e2e/setup.ts',
  globalTeardown: './e2e/teardown.ts',
  use: { baseURL, storageState: 'e2e/.auth.json', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next start --port ${PORT}`, url: `${baseURL}/login`, timeout: 120_000, reuseExistingServer: !process.env.CI, env: { LLM_FIXTURES: '1', NEXT_PUBLIC_SITE_URL: baseURL } },
});
