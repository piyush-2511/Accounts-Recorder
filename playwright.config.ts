import { defineConfig } from "@playwright/test";

/** E2E needs a running app against a STAGING Supabase project with seeded users (see e2e/README.md). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "on-first-retry" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run start", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 120_000 },
});
