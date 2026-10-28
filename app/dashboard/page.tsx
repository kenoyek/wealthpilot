import Link from "next/link";
import Decimal from "decimal.js";
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp } from "lucide-react";
import Shell, { Empty } from "@/components/shell";
import { Filters } from "@/components/filters";
import { journal, localMonth } from "@/lib/data";
import { cashData } from "@/lib/planning-data";
import { formatMoney, sum } from "@/lib/money";
import { totals, categorySpending, cashMovement } from "@/lib/summary";
import { BudgetAlerts } from "@/components/budget-alerts";
import { monthlyBudgets } from "@/lib/insights-data";
import { localDate } from "@/lib/data";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const { client, accounts, categories, profile, positions } = await cashData();
  const q = await searchParams;
  const month = q.month || localMonth(profile?.timezone);
  const scope = ["personal", "business"].includes(q.scope || "")
    ? q.scope!
    : "all";
  const today = localDate(profile?.timezone);
  const [rows, budgets, recurring] = await Promise.all([
    journal(month, scope),
    month === today.slice(0, 7) ? monthlyBudgets(month) : Promise.resolve([]),
    client
      .from("recurring_values")
      .select("id")
      .eq("active", true)
      .lte("next_due", today)
      .limit(200),
  ]);
  if (recurring.error)
    throw new Error("Unable to load recurring reminders. Please retry.");
  const currency = profile?.currency || "NGN";
  const total = totals(rows, currency);
  const selected = accounts.filter(
    (a) => a.currency === currency && (scope === "all" || a.scope === scope),
  );
  const cash = sum(selected.map((a) => a.balance));
  const room = Decimal.max(
    0,
    sum(selected.map((a) => positions[a.id].room)),
  ).toString();
  const foreign = accounts.some((a) => a.currency !== currency);
  const seen = new Set<string>();
  const transactions = rows
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, 5);
  const expenses = categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({ ...c, value: categorySpending(rows, c.id, currency) }))
    .filter((c) => c.value.gt(0))
    .sort((a, b) => b.value.comparedTo(a.value));
  const max = expenses[0]?.value || new Decimal(1);
  const steps = [
    {
      done: Boolean(profile?.onboarded),
      title: "Make it yours",
      copy: "Name, currency and timezone",
      href: "/onboarding",
    },
    {
      done: accounts.length > 0,
      title: "Add your first account",
      copy: "Start with your actual balance",
      href: "/accounts",
    },
    {
      done: rows.some((r) => !["opening", "reversal"].includes(r.kind)),
      title: "Record this month’s activity",
      copy: "Income received or money spent",
      href: "/transactions#new",
    },
  ];
  return (
    <Shell
      active="/dashboard"
      title="Financial overview"
      subtitle="A little clarity today. A stronger tomorrow."
    >
      {steps.some((s) => !s.done) && (
        <section className="setup-guide panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A STRONG START</p>
              <h2>
                {profile?.display_name
                  ? `Welcome, ${profile.display_name}.`
                  : "Your financial story starts here."}
              </h2>
              <p>Three small steps toward a clearer picture.</p>
            </div>
            <span className="pill">
              {steps.filter((s) => s.done).length} of 3 complete
            </span>
          </div>
          <div className="setup-steps">
            {steps.map((s, i) => (
              <Link
                key={s.title}
                href={s.href}
                className={s.done ? "setup-step done" : "setup-step"}
              >
                <span>{s.done ? "✓" : i + 1}</span>
                <div>
                  <b>{s.title}</b>
                  <small>{s.copy}</small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="quick-actions" aria-label="Quick actions">
        <Link href="/transactions?entry=income#new">
          <ArrowUpRight size={17} /> Record income
        </Link>
        <Link href="/transactions?entry=expense#new">
          <ArrowDownLeft size={17} /> Add expense
        </Link>
        <Link href="/planning/goals">Set a goal ↗</Link>
        <Link href="/reports">Explore reports ↗</Link>
        <Link href="/insights">Insights & forecasts ↗</Link>
      </div>
      <Filters month={month} scope={scope} />
      {!!recurring.data?.length && (
        <p className="notice">
          <Link href="/transactions/recurring">
            {recurring.data.length} recurring schedule(s) ready to review →
          </Link>{" "}
          Confirm only payments that actually happened.
        </p>
      )}
      <BudgetAlerts
        budgets={budgets.filter(
          (b) =>
            b.currency === currency &&
            categories.some(
              (c) =>
                c.id === b.category_id &&
                (scope === "all" || c.scope === scope),
            ),
        )}
        rows={rows}
        categories={categories}
        today={today}
        enabled={profile?.planning_alerts !== false}
      />
      <section className="welcome">
        <div>
          <p className="eyebrow">PROTECT YOUR NEXT 30 DAYS</p>
          <h2>{formatMoney(room, currency)} available to plan</h2>
          <p>
            Current cash after goal reserves and uncovered recorded bills/debt
            minimums. Account shortfalls reduce this combined estimate; future
            income and unrecorded obligations are excluded.
          </p>
        </div>
        <Link className="button" href="/planning">
          Cash plan & reminders ↗
        </Link>
      </section>
      {foreign && (
        <p className="notice">
          Showing {currency} only. Other currencies remain separate; no exchange
          rate has been assumed.
        </p>
      )}
      <div className="stats">
        {[
          [
            Wallet,
            "Account balances",
            cash,
            "Current balances, including opening entries",
          ],
          [
            ArrowUpRight,
            "Income this month",
            total.income,
            "Received income, excluding transfers",
          ],
          [
            ArrowDownLeft,
            "Expenses this month",
            total.expenses,
            "Spending less refunds and reversals",
          ],
          [
            TrendingUp,
            "Net cash movement",
            cashMovement(rows, currency),
            "Recorded cash changes; opening balances excluded",
          ],
        ].map(([Icon, label, value, caption]) => {
          const I = Icon as typeof Wallet;
          return (
            <section className="stat" key={String(label)}>
              <div className="stat-top">
                <span>{String(label)}</span>
                <I size={18} />
              </div>
              <strong>{formatMoney(String(value), currency)}</strong>
              <small>{String(caption)}</small>
            </section>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Where your money goes</h2>
              <p>Net spending by category · {currency}</p>
            </div>
            <span className="pill">{month}</span>
          </div>
          {expenses.length ? (
            <div className="spending">
              {expenses.map((c, i) => (
                <div key={c.id}>
                  <div className="bar-label">
                    <span>
                      <span className={"category-dot tone-" + (i % 4)} />
                      {c.name}
                    </span>
                    <b>{formatMoney(c.value.toString(), currency)}</b>
                  </div>
                  <div className="track">
                    <div
                      className={"fill tone-" + (i % 4)}
                      style={{
                        width: c.value.div(max).mul(100).toFixed(2) + "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Make your spending visible">
              Your categories will take shape here as you record expenses.
            </Empty>
          )}
        </section>
        <section className="panel account-card">
          <div className="section-heading">
            <div>
              <h2>Your accounts</h2>
              <p>Every balance, in one place.</p>
            </div>
            <Link href="/accounts">Manage ↗</Link>
          </div>
          {accounts.length ? (
            <div className="account-list">
              {accounts.slice(0, 5).map((a) => (
                <div key={a.id}>
                  <span className="account-icon">{a.currency.slice(0, 1)}</span>
                  <div>
                    <b>{a.name}</b>
                    <small>
                      {a.scope}
                      {a.archived ? " · archived" : ""}
                    </small>
                  </div>
                  <strong>{formatMoney(a.balance, a.currency)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Give your money a home">
              <Link href="/accounts">Add your first account →</Link>
            </Empty>
          )}
          <p className="muted fine">
            Account balances are not a safe-to-spend estimate. Bills and
            reserves are shown separately in your cash plan.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Recent activity</h2>
            <p>The little details behind the bigger picture.</p>
          </div>
          <Link href="/transactions">View all transactions ↗</Link>
        </div>
        {transactions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.description || r.kind}</b>
                      <small>
                        {categories.find((c) => c.id === r.category_id)?.name ||
                          r.scope}
                      </small>
                    </td>
                    <td>{r.effective_date}</td>
                    <td>
                      <span className="pill">{r.kind}</span>
                    </td>
                    <td>
                      {formatMoney(
                        new Decimal(r.amount).abs().toString(),
                        r.currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="A fresh start, without the guesswork">
            Record real income and expenses to see your financial picture come
            together.
          </Empty>
        )}
      </section>
    </Shell>
  );
}
