import Link from "next/link";
import Decimal from "decimal.js";
import Shell, { Notice, Empty } from "@/components/shell";
import { PlanningNav } from "@/components/planning";
import { SubmitButton } from "@/components/submit-button";
import { planningData } from "@/lib/planning-data";
import { localDate, localMonth, journal } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { categorySpending } from "@/lib/summary";
import { reminderPreferences } from "./actions";
export default async function Planning({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const {
    client,
    accounts,
    goals,
    commitments,
    debts,
    positions,
    profile,
    categories,
  } = await planningData();
  const today = localDate(profile?.timezone);
  const month = localMonth(profile?.timezone);
  const lead = profile?.reminder_days ?? 7;
  const end = new Date(today + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + lead);
  const cutoff = end.toISOString().slice(0, 10);
  const reminders = [
    ...commitments
      .filter((c) => c.active && c.next_due && c.next_due <= cutoff)
      .map((c) => ({
        id: c.id,
        href: "/planning/commitments",
        title: c.name,
        detail: (c.next_due! < today ? "Overdue" : "Due") + " " + c.next_due,
      })),
    ...debts
      .filter((d) => new Decimal(d.remaining).gt(0) && d.next_due <= cutoff)
      .map((d) => ({
        id: d.id,
        href: "/planning/debts",
        title: d.name,
        detail: "Debt minimum due " + d.next_due,
      })),
    ...goals
      .filter(
        (g) =>
          new Decimal(g.monthly_plan).gt(0) &&
          new Decimal(g.funded).lt(g.target) &&
          (!g.last_contribution || g.last_contribution < month + "-01"),
      )
      .map((g) => ({
        id: g.id,
        href: "/planning/goals",
        title: g.name,
        detail: "Monthly contribution not yet recorded",
      })),
  ];
  const [budgets, rows] = await Promise.all([
    client
      .from("budget_values")
      .select("*")
      .eq("month", month + "-01"),
    journal(month),
  ]);
  if (budgets.error) throw new Error("Unable to load budget warnings.");
  const budgetWarnings = (budgets.data || []).flatMap((b) => {
    const used = categorySpending(rows, b.category_id, b.currency);
    const percent = used.div(b.amount).mul(100);
    const crossed = [b.threshold, ...b.warning_levels]
      .filter((n) => percent.gte(n))
      .sort((a, b) => b - a)[0];
    return crossed && b.alerts_enabled
      ? [
          {
            id: b.id,
            href: "/budgets",
            title:
              categories.find((c) => c.id === b.category_id)?.name || "Budget",
            detail:
              percent.toFixed(0) +
              "% used · crossed " +
              crossed +
              "% threshold",
          },
        ]
      : [];
  });
  return (
    <Shell
      active="/planning"
      title="Plan your next move"
      subtitle="Protect your essentials. Make space for your goals."
    >
      <PlanningNav />
      <Notice {...await searchParams} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Cash after commitments</h2>
            <p>
              30-day plan · includes overdue recorded cycles · currencies stay
              separate
            </p>
          </div>
          <Link href="/planning/allocate">Allocate received income ↗</Link>
        </div>
        {accounts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Cash balance</th>
                  <th>Goal reserves</th>
                  <th>Uncovered commitments</th>
                  <th>Available to plan</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const p = positions[a.id];
                  return (
                    <tr key={a.id}>
                      <td>
                        {a.name}
                        <small>
                          {a.scope} · through {p.through}
                        </small>
                      </td>
                      <td>{formatMoney(p.cash, a.currency)}</td>
                      <td>{formatMoney(p.reserved, a.currency)}</td>
                      <td>{formatMoney(p.uncovered, a.currency)}</td>
                      <td>
                        <b>{formatMoney(p.safe, a.currency)}</b>
                        {new Decimal(p.room).lt(0) && (
                          <small className="warning-text">
                            {formatMoney(
                              new Decimal(p.room).neg().toString(),
                              a.currency,
                            )}{" "}
                            shortfall
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Start with your actual cash">
            Add an account to begin planning.
          </Empty>
        )}
        <p className="fine muted">
          Available = account cash − earmarked goals − uncovered upcoming bills
          and debt minimums, floored at zero. A linked reserve offsets the
          obligations it covers once, even if shared by several bills. Estimates
          exclude unrecorded obligations, missing interest and future income.
          This is an account-level planning estimate, not a guarantee of
          affordability.
        </p>
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>Reminders & budget warnings</h2>
          {profile?.planning_alerts === false ? (
            <p>In-app reminders are disabled.</p>
          ) : [...reminders, ...budgetWarnings].length ? (
            <ul className="reminder-list">
              {[...reminders, ...budgetWarnings].map((r) => (
                <li key={r.id}>
                  <Link href={r.href}>
                    <b>{r.title}</b>
                    <small>{r.detail}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing needs a reminder today">
              Keep bills, goals and budgets up to date for useful alerts.
            </Empty>
          )}
          <p className="fine muted">
            These reminders appear in the app. No emails, push notifications or
            bank payments are sent.
          </p>
        </section>
        <section className="panel">
          <h2>Your reminder preferences</h2>
          <form action={reminderPreferences}>
            <label>
              In-app reminders
              <select
                name="enabled"
                defaultValue={
                  profile?.planning_alerts === false ? "false" : "true"
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <label>
              Remind me this many days before a bill
              <input
                name="days"
                type="number"
                min={0}
                max={90}
                defaultValue={lead}
                required
              />
            </label>
            <SubmitButton>Save reminder preferences</SubmitButton>
          </form>
          <p className="fine muted">
            Budget milestones follow each budget’s configured levels and custom
            threshold. Each budget shows its highest crossed milestone. Cash
            calculations remain visible when reminders are off.
          </p>
        </section>
      </div>
    </Shell>
  );
}
