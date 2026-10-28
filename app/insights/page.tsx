import Link from "next/link";
import Decimal from "decimal.js";
import Shell, { Empty } from "@/components/shell";
import { BudgetAlerts } from "@/components/budget-alerts";
import { CashForecast } from "@/components/cash-forecast";
import { journalWindow, localDate } from "@/lib/data";
import { cashData } from "@/lib/planning-data";
import { monthlyBudgets } from "@/lib/insights-data";
import { monthSequence, spendingTrends } from "@/lib/insights";
import { currencies, formatMoney } from "@/lib/money";
import { categorySpending } from "@/lib/summary";

export default async function Insights({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string; scope?: string }>;
}) {
  const { accounts, categories, profile, positions } = await cashData();
  const q = await searchParams;
  const currency = currencies.includes(
    q.currency as (typeof currencies)[number],
  )
    ? q.currency!
    : profile?.currency || "NGN";
  const scope = ["personal", "business"].includes(q.scope || "")
    ? q.scope!
    : "all";
  const today = localDate(profile?.timezone);
  const month = today.slice(0, 7);
  const months = monthSequence(today);
  const [rows, budgets] = await Promise.all([
    journalWindow(months[0], month, scope),
    monthlyBudgets(month),
  ]);
  const selected = accounts.filter(
    (a) => a.currency === currency && (scope === "all" || a.scope === scope),
  );
  const selectedPositions = selected.map((a) => positions[a.id]);
  if (selectedPositions.some((p) => !p))
    throw new Error("Unable to load your complete cash plan. Please retry.");
  const trend = spendingTrends(rows, currency, today);
  const currentRows = rows.filter(
    (r) => r.effective_date.startsWith(month) && r.effective_date <= today,
  );
  const selectedCategories = categories.filter(
    (c) => scope === "all" || c.scope === scope,
  );
  const selectedBudgets = budgets.filter(
    (b) =>
      b.currency === currency &&
      selectedCategories.some((c) => c.id === b.category_id),
  );
  const spending = selectedCategories
    .filter((c) => c.kind === "expense")
    .map((c) => ({ ...c, used: categorySpending(currentRows, c.id, currency) }))
    .filter((c) => c.used.gt(0))
    .sort((a, b) => b.used.comparedTo(a.used));
  const max = Decimal.max(
    1,
    ...trend.series.map((s) => Decimal.max(0, s.expenses)),
  );
  const end = new Date(today + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 30);
  const through =
    selectedPositions[0]?.through || end.toISOString().slice(0, 10);
  return (
    <Shell
      active="/insights"
      title="Insights & forecasts"
      subtitle="Understand your patterns. Plan your next move."
    >
      <form className="filters" method="get">
        <label>
          Currency
          <select aria-label="Currency" name="currency" defaultValue={currency}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Scope
          <select aria-label="Scope" name="scope" defaultValue={scope}>
            <option value="all">All finances</option>
            <option value="personal">Personal</option>
            <option value="business">Business</option>
          </select>
        </label>
        <button className="secondary">Apply filters</button>
      </form>
      <p className="fine muted">
        As of {today} · {profile?.timezone || "Africa/Lagos"} · {currency} only.
        Other currencies stay separate. Insights reflect recorded activity, not
        connected bank balances.
      </p>
      <BudgetAlerts
        budgets={selectedBudgets}
        rows={currentRows}
        categories={categories}
        today={today}
        enabled={profile?.planning_alerts !== false}
      />
      <div className="two-col">
        <CashForecast
          key={`${currency}-${scope}`}
          positions={selectedPositions}
          currency={currency}
          through={through}
        />
        <section className="panel">
          <p className="eyebrow">A FAIR COMPARISON</p>
          <h2>Spending compared with last month</h2>
          <p>
            First {trend.comparableDays} days of each month · net of refunds and
            reversals
          </p>
          <strong className="planning-amount">
            {formatMoney(trend.current, currency)}
          </strong>
          <p>
            Compared with {formatMoney(trend.previous, currency)} last month.
          </p>
          <p className="notice">
            {trend.percent === null
              ? "No positive spending baseline for these days last month. Add your records to make the comparison useful."
              : `${new Decimal(trend.difference).isZero() ? "Unchanged" : `${new Decimal(trend.percent).abs().toFixed(1)}% ${new Decimal(trend.difference).gt(0) ? "higher" : "lower"}`} · ${formatMoney(new Decimal(trend.difference).abs().toString(), currency)} difference.`}
          </p>
          <h3>This month’s leading categories</h3>
          {spending.length ? (
            <ul className="insight-alert-list">
              {spending.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <strong>{c.name}</strong>
                  <p>
                    {formatMoney(c.used.toString(), currency)} · {c.scope}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Your patterns start with your records">
              Record expenses to see where your money goes.
            </Empty>
          )}
          <Link href="/transactions">Review transactions ↗</Link>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Spending over time</h2>
            <p>
              Six previous months and this month to date · missing records
              appear as zero
            </p>
          </div>
          <Link href="/reports">Detailed reports ↗</Link>
        </div>
        <div
          className="trend-chart"
          role="img"
          aria-label="Net monthly expense comparison. Exact income, expenses, and surplus are in the table below. Negative net expenses from refunds are shown in the table only."
        >
          {trend.series.map((s) => (
            <div className="trend-column" key={s.month}>
              <div className="trend-bar-space">
                <div
                  className={`trend-bar${s.month === month ? " current" : ""}`}
                  style={{
                    height:
                      Decimal.max(0, s.expenses).div(max).mul(100).toFixed(2) +
                      "%",
                  }}
                />
              </div>
              <span>
                {s.month.slice(5)}
                <small>{s.month.slice(0, 4)}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <caption className="fine">
              Recorded monthly activity · {currency} · {scope}
            </caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Income</th>
                <th>Net expenses</th>
                <th>Operating surplus</th>
              </tr>
            </thead>
            <tbody>
              {trend.series.map((s) => (
                <tr key={s.month}>
                  <td>
                    {s.month}
                    {s.month === month ? " · to date" : ""}
                  </td>
                  <td>{formatMoney(s.income, currency)}</td>
                  <td>{formatMoney(s.expenses, currency)}</td>
                  <td>{formatMoney(s.net, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine muted">
          Effective dates through today. Transfers, opening balances, and debt
          principal are excluded from income and expenses. Refunds and reversals
          reduce the original category. A month with no entries does not prove
          that no spending occurred.
        </p>
      </section>
      <section className="panel">
        <h2>Turn insight into a plan</h2>
        <div className="quick-actions">
          <Link href="/budgets">Adjust a budget ↗</Link>
          <Link href="/planning/commitments">Review upcoming bills ↗</Link>
          <Link href="/planning/goals">Build a buffer ↗</Link>
        </div>
        <p className="fine muted">
          Budget alerts appear inside WealthPilot. Email and push notifications
          are not enabled.{" "}
          {profile?.planning_alerts === false
            ? "Planning alerts are turned off in Planning."
            : "You can adjust warning milestones or disable alerts for each budget."}
        </p>
      </section>
    </Shell>
  );
}
