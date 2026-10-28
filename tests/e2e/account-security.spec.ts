import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
test("complete export, security confirmations, session revocation and explicit account deletion", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  const email = `account-browser-${crypto.randomUUID()}@example.test`,
    password = crypto.randomUUID() + "Aa9!";
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/accounts");
  await page
    .getByLabel("Account name", { exact: true })
    .fill("Account controls fixture");
  await page
    .getByLabel("Opening balance (optional)", { exact: true })
    .fill("1234.56");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("₦1,234.56", { exact: true })).toBeVisible();
  await page.goto("/settings");
  const forbidden = await page.request.post("/api/account/export", {
    headers: { Origin: "https://untrusted.example" },
    form: { currentPassword: password },
  });
  expect(forbidden.status()).toBe(403);
  const form = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Download complete export",
      exact: true,
    }),
  });
  await form
    .getByLabel("Current password for export")
    .fill("Wrong-password-0000");
  await form
    .getByRole("button", { name: "Download complete export", exact: true })
    .click();
  await expect(page.getByText(/Export could not finish/)).toBeVisible();
  await form.getByLabel("Current password for export").fill(password);
  const downloaded = page.waitForEvent("download");
  await form
    .getByRole("button", { name: "Download complete export", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(
    /wealthpilot-complete-.*\.json$/,
  );
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.account.email).toBe(email);
  expect(Object.keys(data.workspace.tables)).toHaveLength(22);
  expect(
    data.workspace.tables.lines.find(
      (r: { bucket: string }) => r.bucket === "asset",
    ).amount,
  ).toBe("1234.56000000");
  expect(JSON.stringify(data)).not.toContain(password);
  await page
    .getByRole("link", { name: "Review account deletion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Delete your account", exact: true }),
  ).toBeVisible();
  const deletion = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Permanently delete my account",
      exact: true,
    }),
  });
  await deletion.getByLabel("Current password", { exact: true }).fill(password);
  await deletion.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE");
  await deletion
    .getByRole("button", { name: "Permanently delete my account", exact: true })
    .click();
  await expect(deletion.locator("p.error")).toContainText(
    "Type DELETE MY ACCOUNT exactly",
  );
  await deletion.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE MY ACCOUNT");
  await deletion
    .getByLabel("Current password", { exact: true })
    .fill("Wrong-password-0000");
  await deletion
    .getByRole("button", { name: "Permanently delete my account", exact: true })
    .click();
  await expect(deletion.locator("p.error")).toContainText(
    "Current password could not be verified",
  );
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  for (const width of [320, 390, 650]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await deletion.getByLabel("Current password", { exact: true }).fill(password);
  await deletion
    .getByRole("button", { name: "Permanently delete my account", exact: true })
    .click();
  await expect(page).toHaveURL(/goodbye/);
  await expect(
    page.getByRole("button", { name: "Retry final cleanup", exact: true }),
  ).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("p.error")).toBeVisible();
  await expect(page).toHaveURL(/login/);
  // A separate disposable identity checks session revocation without touching any real account.
  await page
    .getByLabel("Email", { exact: true })
    .fill(`session-browser-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/settings");
  await page
    .getByLabel("Current password for session revocation")
    .fill(password);
  await page
    .getByRole("button", { name: "Sign out all devices", exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByText(/All device sessions were revoked/),
  ).toBeVisible();
});
