import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("reserve, allocate income, pay bill and split debt payment", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`phase2-browser-${crypto.randomUUID()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(crypto.randomUUID() + "Ab9!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await page.getByLabel("Account name", { exact: true }).fill("Planning bank");
  await page
    .getByLabel("Opening balance (optional)", { exact: true })
    .fill("1000");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("₦1,000.00", { exact: true })).toBeVisible();
  async function createCategory(name: string, kind: string) {
    await page.goto("/transactions");
    const details = page
      .locator("details")
      .filter({ has: page.getByText("Create a category", { exact: true }) });
    await details.locator("summary").click();
    const form = details.locator("form");
    await expect(
      form.getByRole("combobox", { name: "Type", exact: true }),
    ).toBeVisible();
    await form.getByLabel("Name", { exact: true }).fill(name);
    await form
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption(kind);
    await form
      .getByRole("button", { name: "Add category", exact: true })
      .click();
    await page
      .locator("form")
      .filter({
        has: page.getByRole("button", {
          name: "Save transaction",
          exact: true,
        }),
      })
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption(kind);
    await expect(
      page
        .locator('select[name="category"] option')
        .filter({ hasText: name + " · " + kind + " · personal" }),
    ).toHaveCount(1);
  }
  await createCategory("Utilities", "expense");
  await createCategory("Client work", "income");
  const transaction = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save transaction", exact: true }),
  });
  await transaction
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("income");
  await transaction.getByLabel("Amount", { exact: true }).fill("500");
  await transaction
    .getByRole("combobox", { name: "Category (income / expense)", exact: true })
    .selectOption({ label: "Client work · income · personal" });
  await transaction
    .getByLabel("Description", { exact: true })
    .fill("Freelance payment");
  await transaction
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(
    page.getByText("Transaction recorded.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Planning", exact: true }).click();
  await page.getByRole("link", { name: "Savings goals", exact: true }).click();
  const goal = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save goal", exact: true }),
  });
  await goal.getByLabel("Goal name", { exact: true }).fill("Emergency buffer");
  await goal
    .getByRole("combobox", { name: "Purpose", exact: true })
    .selectOption("emergency");
  await goal.getByLabel("Target amount", { exact: true }).fill("2000");
  await goal.getByLabel("Target date", { exact: true }).fill("2028-12-31");
  await goal
    .getByLabel("Essential monthly spending baseline (emergency planning)", {
      exact: true,
    })
    .fill("200");
  await goal.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Emergency buffer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Income allocation", exact: true })
    .click();
  await page
    .getByLabel("Emergency buffer percentage", { exact: true })
    .fill("100");
  await page
    .getByRole("button", { name: "Preview allocation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Review before confirming",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByText("Save these percentages for future income", { exact: true })
    .click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill("Freelance buffer");
  await page
    .getByRole("button", { name: "Save percentage template", exact: true })
    .click();
  await expect(
    page.getByText("Percentage template saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Saved percentage template", exact: true })
    .selectOption({ label: "Freelance buffer" });
  await page
    .getByRole("button", { name: "Use percentage template", exact: true })
    .click();
  await expect(
    page.getByLabel("Emergency buffer percentage", { exact: true }),
  ).toHaveValue("100");
  await page
    .getByRole("button", { name: "Preview allocation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Review before confirming",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm virtual allocation", exact: true })
    .click();
  await expect(
    page.getByText("Allocation confirmed. Funds were earmarked, not moved.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Cash & reminders", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: "Planning bank" });
  await expect(row.getByText("₦1,500.00", { exact: true })).toBeVisible();
  await expect(row.getByText("₦500.00", { exact: true })).toBeVisible();
  await expect(row.getByText("₦1,000.00", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Bills & subscriptions", exact: true })
    .click();
  const bill = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save commitment", exact: true }),
  });
  await bill
    .getByLabel("Name / provider", { exact: true })
    .fill("Internet plan");
  await bill
    .getByLabel("Amount per billing cycle", { exact: true })
    .fill("100");
  await bill
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("once");
  await bill
    .getByRole("combobox", { name: "Expense category", exact: true })
    .selectOption({ label: "Utilities · personal" });
  await bill
    .getByRole("button", { name: "Save commitment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Internet plan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm actual payment", exact: true })
    .click();
  await expect(
    page.getByText("Actual payment recorded and due date advanced.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Debts", exact: true }).click();
  const debt = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save debt", exact: true }),
  });
  await debt.getByLabel("Debt name", { exact: true }).fill("Equipment loan");
  await debt.getByLabel("Outstanding principal", { exact: true }).fill("300");
  await debt
    .getByLabel("Contractual monthly minimum", { exact: true })
    .fill("50");
  await debt.getByRole("button", { name: "Save debt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Equipment loan", exact: true }),
  ).toBeVisible();
  const payment = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Confirm debt payment",
      exact: true,
    }),
  });
  await payment.getByLabel("Principal paid", { exact: true }).fill("40");
  await payment
    .getByLabel("Interest / fees actually paid", { exact: true })
    .fill("10");
  await payment
    .getByRole("combobox", { name: "Interest expense category", exact: true })
    .selectOption({ label: "Utilities" });
  await payment
    .getByRole("button", { name: "Confirm debt payment", exact: true })
    .click();
  await expect(
    page.getByText(
      "Debt payment recorded. Only interest counts as an expense.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("₦260.00", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  const report = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "NGN", exact: true }) });
  await expect(report.getByText("₦110.00", { exact: true })).toBeVisible();
  await expect(report.getByText("₦500.00", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Planning", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plan your next move", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
