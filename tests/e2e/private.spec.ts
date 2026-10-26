import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { parseEnv } from "node:util";
import { readFileSync } from "node:fs";
const local = parseEnv(readFileSync(".env.local", "utf8"));
const backend =
  process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(backend || ""))
  throw new Error(
    "Private-policy fixtures require disposable local infrastructure.",
  );
const fixtureKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!fixtureKey) throw new Error("Local fixture API key is missing.");
const owner = process.env.WEALTHPILOT_TEST_OWNER_EMAIL!;
const stranger = "private-stranger-" + crypto.randomUUID() + "@example.test";
const password = crypto.randomUUID() + "Aa9!";
test.beforeAll(async () => {
  const client = createClient(backend!, fixtureKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const email of [owner, stranger]) {
    const { error } = await client.auth.signUp({ email, password });
    if (error)
      throw new Error("Unable to create a disposable private-policy fixture.");
  }
});
test("private release permits its verified owner and rejects another valid user", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(owner);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Financial overview", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await page
    .getByLabel("Account name", { exact: true })
    .fill("Private owner account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Private owner account", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  // An otherwise-valid authenticated session is not enough for the private app.
  await page.goto("http://127.0.0.1:3001/login");
  await page.getByLabel("Email", { exact: true }).fill(stranger);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("http://127.0.0.1:3002/accounts");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByText("Private owner account", { exact: true }),
  ).toHaveCount(0);
  const response = await page.request.get("http://127.0.0.1:3002/api/export", {
    maxRedirects: 0,
  });
  expect([303, 307, 308]).toContain(response.status());
  expect(response.headers().location).toContain("/login");
  await page.getByLabel("Email", { exact: true }).fill(stranger);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Unable to sign in." }),
  ).toBeVisible();
});
