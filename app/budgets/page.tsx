import Shell, { Notice, Empty } from "@/components/shell";
import { baseData, journal, localMonth } from "@/lib/data";
import { currencies, formatMoney } from "@/lib/money";
import { categorySpending } from "@/lib/summary";
import { saveBudget } from "../actions";
export default async function Budgets({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { client, categories, profile } = await baseData();
  const month = localMonth(profile?.timezone);
  const rows = await journal(month);
  const { data: budgets, error } = await client
    .from("budget_values")
    .select("*")
    .eq("month", month + "-01");
  if (error) throw new Error("Unable to load budgets.");
  const expense = categories.filter((c) => c.kind === "expense");
  return (
    <Shell
      active="/budgets"
      title="Monthly budgets"
      subtitle="Give your spending a direction, without losing flexibility."
    >
      <Notice {...await searchParams} />
      <div className="two-col">
        <section className="panel">
          <h2>This month · {month}</h2>
          {budgets?.length ? (
            <div className="spending">
              {budgets.map((b) => {
                const used = categorySpending(rows, b.category_id, b.currency);
                const percent = used.div(b.amount).mul(100);
                const warning =
                  b.alerts_enabled &&
                  profile?.planning_alerts !== false &&
                  [b.threshold, ...b.warning_levels].some((n) =>
                    percent.gte(n),
                  );
                return (
                  <div key={b.id}>
                    <div className="bar-label">
                      <b>
                        {categories.find((c) => c.id === b.category_id)?.name}
                      </b>
                      <span>
                        {formatMoney(used.toString(), b.currency)} /{" "}
                        {formatMoney(b.amount, b.currency)}
                      </span>
                    </div>
                    <div className="track">
                      <div
                        className={"fill " + (warning ? "warning" : "")}
                        style={{
                          width: percent.clamp(0, 100).toFixed(2) + "%",
                        }}
                      />
                    </div>
                    <small className={warning ? "warning-text" : "muted"}>
                      {percent.toFixed(0)}% used ·{" "}
                      {formatMoney(
                        used.neg().plus(b.amount).toString(),
                        b.currency,
                      )}{" "}
                      remaining
                      {warning ? " · Review your spending" : ""}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty title="A plan that works for you">
              Set a category budget to see spending and remaining room side by
              side.
            </Empty>
          )}
        </section>
        <section className="panel">
          <h2>Set a monthly budget</h2>
          {expense.length ? (
            <form action={saveBudget}>
              <label>
                Expense category
                <select name="category">
                  {expense.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.scope}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Month
                  <input
                    type="month"
                    name="month"
                    defaultValue={month}
                    required
                  />
                </label>
                <label>
                  Currency
                  <select
                    name="currency"
                    defaultValue={profile?.currency || "NGN"}
                  >
                    {currencies.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Budget amount
                <input name="amount" inputMode="decimal" required />
              </label>
              <label>
                Warning threshold (%)
                <input
                  name="threshold"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={90}
                  required
                />
              </label>
              <label>
                Additional warning milestones (%)
                <input
                  name="levels"
                  defaultValue="50,75,90,100"
                  placeholder="e.g. 50,75,90,100"
                />
              </label>
              <label>
                Budget alerts
                <select name="alerts">
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
              <p className="fine muted">
                Saving the same category, month and currency replaces its budget
                amount. Budgets do not move money.
              </p>
              <button>Save budget</button>
            </form>
          ) : (
            <p>Create an expense category in Transactions first.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
