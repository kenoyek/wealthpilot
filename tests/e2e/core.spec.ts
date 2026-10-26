import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("private account to reconciled financial report", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Make room for what matters." }),
  ).toBeVisible();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`browser-${crypto.randomUUID()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(crypto.randomUUID() + "Ab9!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("₦0.00", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await page.getByLabel("Account name").fill("Everyday");
  await page
    .getByLabel("Opening balance (optional)", { exact: true })
    .fill("1000.00");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("₦1,000.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page.getByText("Create a category", { exact: true }).click();
  const category = page
    .locator("form")
    .filter({ has: page.getByPlaceholder("e.g. Groceries") });
  await category.getByLabel("Name", { exact: true }).fill("Groceries");
  await category.getByRole("button", { name: "Add category" }).click();
  await expect(
    page
      .locator('select[name="category"] option')
      .filter({ hasText: "Groceries · expense · personal" }),
  ).toHaveCount(1);
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Save transaction" }) });
  const firstKey = await form.locator('input[name="key"]').inputValue();
  await form.getByLabel("Amount", { exact: true }).fill("30.00");
  await form
    .getByLabel("Category (income / expense)")
    .selectOption({ label: "Groceries · expense · personal" });
  await form.getByLabel("Description", { exact: true }).fill("Weekly shop");
  await expect(form.getByLabel("Amount", { exact: true })).toHaveValue("30.00");
  expect(
    await form
      .getByLabel("Amount", { exact: true })
      .evaluate((el: HTMLInputElement) => ({
        valid: el.validity.valid,
        pattern: el.pattern,
      })),
  ).toMatchObject({ valid: true });
  await form.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction recorded.")).toBeVisible();
  await expect(page.getByText("Weekly shop", { exact: true })).toBeVisible();
  await expect(form.getByLabel("Amount", { exact: true })).toHaveValue("");
  await expect(form.locator('input[name="key"]')).not.toHaveValue(firstKey);
  const retryKey = await form.locator('input[name="key"]').inputValue();
  await form
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("refund");
  await form.getByLabel("Amount", { exact: true }).fill("10");
  await form
    .getByLabel("Original expense (refunds only)")
    .fill(crypto.randomUUID());
  await form
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(form.locator('p.error[role="alert"]')).toBeVisible();
  await expect(form.getByLabel("Amount", { exact: true })).toHaveValue("10");
  await expect(form.locator('input[name="key"]')).toHaveValue(retryKey);

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByText("₦970.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("₦30.00", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page.getByText("₦30.00", { exact: true }).first()).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/wealthpilot.*csv/);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Financial overview" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/reports");
  await expect(page).toHaveURL(/login/);
});
