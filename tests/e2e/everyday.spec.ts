import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("recurring confirmations and previewed CSV import reconcile and undo on mobile", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  await page.goto("/transactions/import");
  await expect(page).toHaveURL(/login/);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`everyday-browser-${crypto.randomUUID()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(crypto.randomUUID() + "Aa9!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/accounts");
  await page
    .getByLabel("Account name", { exact: true })
    .fill("Everyday browser bank");
  await page
    .getByLabel("Opening balance (optional)", { exact: true })
    .fill("1000");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("₦1,000.00", { exact: true })).toBeVisible();
  await page.goto("/transactions/recurring");
  const create = page.locator("form").filter({
    has: page.getByRole("button", { name: "Create schedule", exact: true }),
  });
  await create
    .getByLabel("Schedule name", { exact: true })
    .fill("Groceries schedule");
  await create
    .getByRole("combobox", { name: "Schedule category", exact: true })
    .selectOption({ label: "Food & groceries" });
  await create.getByLabel("Amount per occurrence").fill("20");
  await create.getByLabel("Next due date").fill("2024-01-31");
  await create
    .getByRole("button", { name: "Create schedule", exact: true })
    .click();
  await expect(
    page.getByText("Recurring schedule saved. No money was moved.", {
      exact: true,
    }),
  ).toBeVisible();
  let card = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Groceries schedule",
      exact: true,
    }),
  });
  await card
    .getByRole("button", { name: "Confirm actual transaction", exact: true })
    .click();
  await expect(
    page.getByText("Transaction recorded. The next due date has advanced.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    card.getByText("Next due: 2024-02-29", { exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Skip occurrence", exact: true })
    .click();
  await expect(
    card.getByText("Next due: 2024-03-31", { exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Pause schedule", exact: true })
    .click();
  await expect(card.getByText("Paused", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", {
      name: "Confirm actual transaction",
      exact: true,
    }),
  ).toHaveCount(0);
  await card
    .getByRole("button", { name: "Resume schedule", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Pause schedule", exact: true }),
  ).toBeVisible();
  await card.locator("summary").filter({ hasText: "Edit schedule" }).click();
  await card
    .getByLabel("Schedule name", { exact: true })
    .fill("Groceries updated");
  await card.getByLabel("Amount per occurrence").fill("25");
  await card
    .getByRole("button", { name: "Save schedule changes", exact: true })
    .click();
  card = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Groceries updated",
      exact: true,
    }),
  });
  await expect(card.getByText("₦25.00", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/accounts");
  await expect(page.getByText("₦980.00", { exact: true })).toBeVisible();
  await page.goto("/transactions/import");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const csv = `date,type,amount,description,reference\n${today},expense,10,Imported shopping,bank-1\n${today},income,30,Imported pay,bank-2\n${today},expense,10,Imported shopping,bank-1\n`;
  await page
    .getByRole("combobox", { name: "Category for expenses", exact: true })
    .selectOption({ label: "Food & groceries" });
  await page
    .getByRole("combobox", { name: "Category for income", exact: true })
    .selectOption({ label: "Salary & wages" });
  const upload = () =>
    page.getByLabel("Choose a CSV file").setInputFiles({
      name: "bank.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await upload();
  await expect(page.getByLabel("CSV contents")).toHaveValue(csv);
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your import", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/2 new transaction\(s\).*1 duplicate\(s\)/),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Review your import", exact: true })
      .locator("dl dd"),
  ).toHaveText(["₦30.00", "₦10.00"]);
  await expect(
    page.getByRole("combobox", { name: "Category for expenses", exact: true }),
  ).not.toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Category for income", exact: true }),
  ).not.toHaveValue("");
  const other = await page.context().newPage();
  await other.goto("/accounts");
  await expect(other.getByText("₦980.00", { exact: true })).toBeVisible();
  await other.close();
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  for (const width of [320, 390, 650]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeInViewport({ ratio: 1 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".tools/import-mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(
    page.getByText("Imported 2 transaction(s). Skipped 1 duplicate(s).", {
      exact: true,
    }),
  ).toBeVisible();
  await upload();
  await expect(page.getByLabel("CSV contents")).toHaveValue(csv);
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(page.getByText(/Nothing new to import/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
  await page
    .getByLabel("CSV contents")
    .fill(`date,type,amount,description\n${today},expense,0.001,Bad precision`);
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(page.locator("form p.error[role=alert]")).toContainText("Row 1");
  await page.goto("/accounts");
  await expect(page.getByText("₦1,000.00", { exact: true })).toBeVisible();
  await page.goto("/transactions/import");
  await page.locator("summary").filter({ hasText: "Undo this import" }).click();
  await page
    .getByRole("button", { name: "Confirm undo import", exact: true })
    .click();
  await expect(
    page.getByText(
      "Import undone with reversals. Duplicate protection is retained.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText("₦980.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/transactions/recurring");
  await expect(page).toHaveURL(/login/);
});
