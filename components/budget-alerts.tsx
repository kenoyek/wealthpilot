import Link from "next/link";
import type { Category, Line } from "@/lib/data";
import { budgetSignals, type Budget } from "@/lib/insights";
import { formatMoney } from "@/lib/money";

export function BudgetAlerts({
  budgets,
  rows,
  categories,
  today,
  enabled,
}: {
  budgets: Budget[];
  rows: Line[];
  categories: Category[];
  today: string;
  enabled: boolean;
}) {
  const alerts = budgetSignals(budgets, rows, today, enabled)
    .filter((b) => ["over", "milestone", "pace"].includes(b.status))
    .sort((a, b) => {
      const rank = { over: 0, milestone: 1, pace: 2 };
      return (
        rank[a.status as keyof typeof rank] -
        rank[b.status as keyof typeof rank]
      );
    });
  if (!alerts.length) return null;
  return (
    <section
      className="panel budget-alerts"
      aria-labelledby="budget-alert-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="budget-alert-title">Budget alerts</h2>
          <p>Recorded spending through {today} · in-app alerts</p>
        </div>
        <Link href="/budgets">Manage budgets ↗</Link>
      </div>
      <ul className="insight-alert-list">
        {alerts.map((b) => (
          <li key={b.id}>
            <strong>
              {categories.find((c) => c.id === b.category_id)?.name ||
                "Category"}{" "}
              · {b.currency}
            </strong>
            <p>
              {b.status === "over"
                ? `${formatMoney(b.remaining.slice(1), b.currency)} over budget.`
                : b.status === "pace"
                  ? `At this month’s recorded pace, spending could reach ${formatMoney(b.projected, b.currency)} against a ${formatMoney(b.amount, b.currency)} budget.`
                  : `${b.percent}% used · ${b.milestone}% warning milestone reached.`}{" "}
              {b.status !== "over" &&
                `${formatMoney(b.remaining, b.currency)} remaining.`}
            </p>
          </li>
        ))}
      </ul>
      <p className="fine muted">
        Pace estimates start after seven days, assume spending continues evenly,
        and depend on complete records. Change alert preferences in Planning or
        Budgets.
      </p>
    </section>
  );
}
