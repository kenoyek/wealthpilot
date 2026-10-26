import { defineConfig } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
const local = existsSync(".env.local")
  ? parseEnv(readFileSync(".env.local", "utf8"))
  : {};
const backend =
  process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(backend))
  throw new Error(
    "Browser fixtures require disposable local Supabase; hosted targets are refused.",
  );
if (process.env.NEON_AUTH_BASE_URL || process.env.NEON_DATA_API_URL)
  throw new Error("Hosted Neon is not a browser fixture backend.");
const privateOwner =
  process.env.WEALTHPILOT_TEST_OWNER_EMAIL ||
  "private-owner-" + randomUUID() + "@example.test";
process.env.WEALTHPILOT_TEST_OWNER_EMAIL = privateOwner;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: "local-regression", testIgnore: "**/private.spec.ts" },
    {
      name: "private-access",
      testMatch: "**/private.spec.ts",
      use: { baseURL: "http://127.0.0.1:3002" },
    },
  ],
  webServer: [
    {
      command: "npm run start -- --port 3001",
      url: "http://127.0.0.1:3001/login",
      reuseExistingServer: false,
      env: { WEALTHPILOT_PRIVATE_RELEASE: "false" },
    },
    {
      command: "npm run start -- --port 3002",
      url: "http://127.0.0.1:3002/login",
      reuseExistingServer: false,
      env: {
        WEALTHPILOT_PRIVATE_RELEASE: "true",
        WEALTHPILOT_OWNER_EMAIL: privateOwner,
      },
    },
  ],
  reporter: "list",
});
