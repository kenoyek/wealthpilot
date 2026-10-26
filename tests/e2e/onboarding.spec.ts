import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("new users receive a guided private workspace and isolated accounts", async ({
  page,
}) => {
  const email = `onboarding-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID() + "Ab9!";
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A clearer picture/ }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/onboarding");
  await page.getByLabel("What should we call you?").fill("Ada");
  await page.getByLabel("Account name", { exact: true }).fill("Ada everyday");
  await page.getByLabel("Current balance", { exact: true }).fill("1000.00");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Ada everyday", { exact: true })).toBeVisible();
  await expect(
    page.getByText("₦1,000.00", { exact: true }).first(),
  ).toBeVisible();
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`second-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Ada everyday", { exact: true })).toHaveCount(0);
  await expect(page.getByText("₦0.00", { exact: true }).first()).toBeVisible();
});
