import { CommitmentFunding } from "@/components/commitment-funding";
import Shell, { Notice, Empty } from "@/components/shell";
import { PlanningNav, RequestKey, PaymentUndo } from "@/components/planning";
import { SubmitButton } from "@/components/submit-button";
import { planningData } from "@/lib/planning-data";
import { localDate } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { monthlyEquivalent } from "@/lib/planning";
import Decimal from "decimal.js";
import { saveCommitment, payCommitment, changeCommitment } from "../actions";
export default async function Commitments({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const {
    client,
    accounts,
    categories,
    goals,
    commitments,
    payments,
    profile,
  } = await planningData();
  const today = localDate(profile?.timezone);
  const expenses = categories.filter((c) => c.kind === "expense");
  const { data: history, error } = await client
    .from("price_history")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load subscription price history.");
  return (
    <Shell
      active="/planning"
      title="Bills & subscriptions"
      subtitle="Fewer surprises. A clearer view of what’s coming."
    >
      <PlanningNav />
      <Notice {...await searchParams} />
      <details className="panel" open={!commitments.length}>
        <summary>Add a bill or subscription</summary>
        {accounts.some((a) => !a.archived) && expenses.length ? (
          <form action={saveCommitment}>
            <RequestKey />
            <div className="form-grid">
              <label>
                Name / provider
                <input name="name" maxLength={80} required />
              </label>
              <label>
                Type
                <select name="kind">
                  <option value="bill">Bill</option>
                  <option value="subscription">Subscription</option>
                </select>
              </label>
              <label>
                Plan (optional)
                <input name="plan" maxLength={100} />
              </label>
              <CommitmentFunding
                accounts={accounts}
                categories={categories}
                goals={goals}
              />
              <label>
                Amount per billing cycle
                <input name="amount" inputMode="decimal" required />
              </label>
              <label>
                Frequency
                <select name="cadence">
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="weekly">Weekly</option>
                  <option value="once">One-time</option>
                </select>
              </label>
              <label>
                Next due date
                <input name="date" type="date" required defaultValue={today} />
              </label>
              <label>
                Importance
                <select name="essential">
                  <option value="true">Essential</option>
                  <option value="false">Optional / review</option>
                </select>
              </label>
              <label>
                Cancellation URL (optional)
                <input
                  name="url"
                  type="url"
                  placeholder="https://provider.example/account"
                />
              </label>
            </div>
            <p className="fine muted">
              The account, category and any linked reserve must share the same
              scope and currency. Only record payments that actually happened.
            </p>
            <SubmitButton>Save commitment</SubmitButton>
          </form>
        ) : (
          <p>Add an account and expense category first.</p>
        )}
      </details>
      <div className="goal-grid">
        {commitments.map((c) => {
          const a = accounts.find((a) => a.id === c.account_id)!;
          const monthly = monthlyEquivalent(c.amount, c.cadence);
          const prices = (history || []).filter(
            (p) => p.commitment_id === c.id,
          );
          const duplicate = commitments.some(
            (o) =>
              o.id !== c.id &&
              o.active &&
              c.active &&
              o.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
          );
          return (
            <section className="panel" key={c.id}>
              <div className="section-heading">
                <div>
                  <h2>{c.name}</h2>
                  <p>
                    {c.kind} · {c.plan || c.cadence} · {a.name}
                  </p>
                </div>
                <span className="pill">
                  {!c.active
                    ? "Not tracking"
                    : c.next_due! < today
                      ? "Overdue"
                      : c.essential
                        ? "Essential"
                        : "Review"}
                </span>
              </div>
              <strong className="planning-amount">
                {formatMoney(c.amount, a.currency)}
              </strong>
              <p className="fine">
                {c.cadence} ·{" "}
                {c.next_due ? "next due " + c.next_due : "no future renewal"}
              </p>
              {monthly && (
                <p className="fine muted">
                  Planning equivalent: {formatMoney(monthly, a.currency)}/month
                  ·{" "}
                  {formatMoney(
                    new Decimal(monthly).mul(12).toString(),
                    a.currency,
                  )}
                  /year. Actual charges follow due dates.
                </p>
              )}
              {duplicate && (
                <p className="notice">
                  Another active item has the same provider name. Review for a
                  possible duplicate; usage has not been inferred.
                </p>
              )}
              {c.active && c.next_due && (
                <form action={payCommitment}>
                  <RequestKey />
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="due" value={c.next_due} />
                  <input type="hidden" name="quote" value={c.amount} />
                  <label>
                    Actual payment date
                    <input
                      name="date"
                      type="date"
                      defaultValue={today}
                      required
                    />
                  </label>
                  <p className="fine muted">
                    Confirm only after paying{" "}
                    {formatMoney(c.amount, a.currency)} yourself. Any linked
                    reserve is consumed once; no real payment is initiated.
                  </p>
                  <SubmitButton>Confirm actual payment</SubmitButton>
                </form>
              )}
              <details>
                <summary>Price history & tracking</summary>
                <ul>
                  {prices.map((p) => (
                    <li key={p.id}>
                      {p.recorded_at.slice(0, 10)} ·{" "}
                      {formatMoney(p.amount, a.currency)}
                    </li>
                  ))}
                </ul>
                {prices.length > 1 &&
                  new Decimal(prices[0].amount).gt(prices[1].amount) && (
                    <p className="notice">
                      The latest recorded price increased.
                    </p>
                  )}
                <form action={changeCommitment} className="inline-form">
                  <RequestKey />
                  <input type="hidden" name="id" value={c.id} />
                  <label>
                    New future price
                    <input name="amount" inputMode="decimal" required />
                  </label>
                  <SubmitButton secondary>Update future price</SubmitButton>
                </form>
                {c.active && (
                  <form action={changeCommitment}>
                    <RequestKey />
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="mode" value="stop" />
                    <SubmitButton secondary>
                      Stop tracking future renewals
                    </SubmitButton>
                  </form>
                )}
                {c.cancel_url && (
                  <p>
                    <a
                      href={c.cancel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Provider cancellation page ↗
                    </a>
                  </p>
                )}
                <p className="fine muted">
                  Stopping tracking does not cancel your provider subscription.
                </p>
              </details>
            </section>
          );
        })}
      </div>
      {!commitments.length && (
        <Empty title="Make predictable expenses predictable">
          Add rent, internet, domains or subscriptions to see upcoming
          commitments.
        </Empty>
      )}
      <PaymentUndo
        rows={payments.filter((p) => p.kind === "commitment")}
        today={today}
      />
    </Shell>
  );
}
