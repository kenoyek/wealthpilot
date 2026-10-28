import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("insights reconcile recorded cash, bills, budgets and private what-if inputs", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  await page.goto("/insights");
  await expect(page).toHaveURL(/login/);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`insights-${crypto.randomUUID()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(crypto.randomUUID() + "Ab9!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/accounts");
  await page.getByLabel("Account name", { exact: true }).fill("Insight bank");
  await page
    .getByLabel("Opening balance (optional)", { exact: true })
    .fill("1000");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Insight bank", { exact: true })).toBeVisible();
  await page.goto("/transactions");
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save transaction", exact: true }),
  });
  await form
    .getByLabel("Category (income / expense)")
    .selectOption({ label: "Food & groceries · expense · personal" });
  await form.getByLabel("Amount", { exact: true }).fill("90");
  await form
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(
    page.getByText("Transaction recorded.", { exact: true }),
  ).toBeVisible();
  await page.goto("/budgets");
  const budget = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save budget", exact: true }),
  });
  await budget
    .getByLabel("Expense category")
    .selectOption({ label: "Food & groceries · personal" });
  await budget.getByLabel("Budget amount").fill("100");
  await budget
    .getByRole("button", { name: "Save budget", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Budget alerts", exact: true }),
  ).toBeVisible();
  await page.goto("/planning/commitments");
  const bill = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save commitment", exact: true }),
  });
  await bill.getByLabel("Name / provider").fill("Future bill");
  await bill.getByLabel("Amount per billing cycle").fill("100");
  await bill
    .getByLabel("Expense category")
    .selectOption({ label: "Food & groceries · personal" });
  await bill.getByLabel("Frequency").selectOption("once");
  await bill
    .getByRole("button", { name: "Save commitment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Future bill", exact: true }),
  ).toBeVisible();
  await page.goto("/insights");
  const forecast = page.getByRole("region", {
    name: "30-day cash-flow forecast",
  });
  const result = (label: string) =>
    forecast
      .locator("dl > div")
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator("dd");
  await expect(result("Recorded cash")).toHaveText("₦910.00");
  await expect(result("Recorded obligations")).toHaveText("− ₦100.00");
  await expect(result("Estimated closing cash")).toHaveText("₦810.00");
  await forecast.getByLabel("Expected additional income (NGN)").fill("100");
  await forecast.getByLabel("Other expected spending (NGN)").fill("50");
  await expect(result("Estimated closing cash")).toHaveText("₦860.00");
  await expect(result("Estimated room after reserves")).toHaveText("₦860.00");
  expect(page.url()).not.toContain("100");
  await forecast.getByLabel("Other expected spending (NGN)").fill("2000");
  await expect(
    forecast.getByText(/This scenario leaves a shortfall/),
  ).toBeVisible();
  await forecast.getByLabel("Other expected spending (NGN)").fill("0.001");
  await expect(forecast.getByRole("alert")).toBeVisible();
  await forecast.getByLabel("Other expected spending (NGN)").fill("50");
  await expect(
    page.getByRole("heading", { name: "Budget alerts", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("row").last()).toContainText("₦90.00");
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.screenshot({
    path: ".tools/insights-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 650]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(
      page.getByRole("link", { name: "Insights", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: ".tools/insights-mobile.png", fullPage: true });
  await page.getByLabel("Currency", { exact: true }).selectOption("USD");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(result("Recorded cash")).toHaveText("US$0.00");
  await expect(
    page.getByRole("heading", { name: "Budget alerts", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Currency", { exact: true }).selectOption("NGN");
  await page.getByLabel("Scope", { exact: true }).selectOption("business");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(result("Recorded cash")).toHaveText("₦0.00");
  await expect(
    page.getByRole("heading", { name: "Budget alerts", exact: true }),
  ).toHaveCount(0);
  await page.goto("/planning");
  await page
    .getByRole("combobox", { name: /^In-app reminders/ })
    .selectOption("false");
  await page
    .getByRole("button", { name: "Save reminder preferences", exact: true })
    .click();
  await expect(
    page.getByText("Reminder preferences saved.", { exact: true }),
  ).toBeVisible();
  await page.goto("/insights");
  await expect(
    page.getByRole("heading", { name: "Budget alerts", exact: true }),
  ).toHaveCount(0);
  await expect(result("Recorded cash")).toHaveText("₦910.00");
  await expect(result("Estimated closing cash")).toHaveText("₦810.00");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`insights-second-${crypto.randomUUID()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(crypto.randomUUID() + "Ab9!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/insights");
  await expect(result("Recorded cash")).toHaveText("₦0.00");
  await expect(result("Recorded obligations")).toHaveText("− ₦0.00");
  await expect(
    page.getByRole("heading", { name: "Budget alerts", exact: true }),
  ).toHaveCount(0);
});
