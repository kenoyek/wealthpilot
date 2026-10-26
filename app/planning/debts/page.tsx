import Shell, { Notice, Empty } from "@/components/shell";
import {
  PlanningNav,
  RequestKey,
  AccountSelect,
  ReserveSelect,
  PaymentUndo,
} from "@/components/planning";
import { SubmitButton } from "@/components/submit-button";
import { planningData } from "@/lib/planning-data";
import { localDate } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { debtScenario, scenarioExtra } from "@/lib/planning";
import Decimal from "decimal.js";
import { createDebt, payDebt, voidDebt, updateDebtPlan } from "../actions";
export default async function Debts({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    notice?: string;
    extra?: string;
    currency?: string;
  }>;
}) {
  const { accounts, categories, goals, debts, payments, profile } =
    await planningData();
  const q = await searchParams;
  const today = localDate(profile?.timezone);
  const currency = q.currency || profile?.currency || "NGN";
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const selected = debts.filter(
    (d) =>
      accounts.find((a) => a.id === d.account_id)?.currency === currency &&
      new Decimal(d.remaining).gt(0),
  );
  let scenarioError = "";
  let comparison: ReturnType<typeof debtScenario>[] = [];
  try {
    const extra = scenarioExtra(q.extra || "0", currency);
    comparison = ["avalanche", "snowball"].map((m) =>
      debtScenario(selected, extra, currency, m as "avalanche" | "snowball"),
    );
  } catch {
    scenarioError = "Enter a valid nonnegative extra payment.";
  }
  return (
    <Shell
      active="/planning"
      title="Debt & obligations"
      subtitle="A clear plan for what you owe, one payment at a time."
    >
      <PlanningNav />
      <Notice error={q.error || scenarioError} notice={q.notice} />
      <details className="panel" open={!debts.length}>
        <summary>Record an existing debt</summary>
        <form action={createDebt}>
          <RequestKey />
          <div className="form-grid">
            <label>
              Debt name
              <input name="name" maxLength={80} required />
            </label>
            <AccountSelect accounts={accounts} />
            <label>
              Outstanding principal
              <input name="principal" inputMode="decimal" required />
            </label>
            <label>
              Contractual monthly minimum
              <input name="minimum" inputMode="decimal" required />
            </label>
            <label>
              Annual rate (%) for scenarios
              <input name="apr" inputMode="decimal" defaultValue="0" required />
            </label>
            <label>
              Next due date
              <input name="date" type="date" defaultValue={today} required />
            </label>
            <ReserveSelect goals={goals} />
          </div>
          <p className="fine muted">
            This records an existing liability, not new income or spending. Use
            your statement’s principal and minimum. Actual payment interest is
            entered explicitly.
          </p>
          <SubmitButton>Save debt</SubmitButton>
        </form>
      </details>
      <div className="goal-grid">
        {debts.map((d) => {
          const a = accounts.find((a) => a.id === d.account_id)!;
          return (
            <section className="panel" key={d.id}>
              <h2>{d.name}</h2>
              <p className="fine">
                {a.name} · due {d.next_due}
              </p>
              <strong className="planning-amount">
                {formatMoney(d.remaining, a.currency)}
              </strong>
              <p className="fine muted">
                Remaining principal · minimum{" "}
                {formatMoney(d.minimum, a.currency)}/month · annual rate {d.apr}
                %
              </p>
              {new Decimal(d.remaining).gt(0) ? (
                <form action={payDebt}>
                  <RequestKey />
                  <input type="hidden" name="id" value={d.id} />
                  <div className="form-row">
                    <label>
                      Principal paid
                      <input name="principal" inputMode="decimal" required />
                    </label>
                    <label>
                      Interest / fees actually paid
                      <input
                        name="interest"
                        inputMode="decimal"
                        defaultValue="0"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Interest expense category
                    <select name="category">
                      <option value="">None (zero interest only)</option>
                      {categories
                        .filter(
                          (c) => c.kind === "expense" && c.scope === a.scope,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
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
                    Confirm a payment already made. Principal reduces the
                    liability; only interest/fees affect expenses. Partial
                    payments keep the current due date until the minimum is met.
                  </p>
                  <SubmitButton>Confirm debt payment</SubmitButton>
                </form>
              ) : (
                <p className="notice">
                  {d.voided ? "Opening reversed" : "Principal repaid."}
                </p>
              )}
              {!d.voided && (
                <details>
                  <summary>Update terms or correct opening</summary>
                  <form action={updateDebtPlan}>
                    <RequestKey />
                    <input type="hidden" name="id" value={d.id} />
                    <label>
                      Updated monthly minimum
                      <input
                        name="minimum"
                        inputMode="decimal"
                        defaultValue={d.minimum}
                        required
                      />
                    </label>
                    <label>
                      Updated annual rate (%)
                      <input
                        name="apr"
                        inputMode="decimal"
                        defaultValue={d.apr}
                        required
                      />
                    </label>
                    <SubmitButton secondary>Update planning terms</SubmitButton>
                  </form>
                  <form action={voidDebt}>
                    <RequestKey />
                    <input type="hidden" name="id" value={d.id} />
                    <label>
                      Opening correction reason
                      <input
                        name="reason"
                        minLength={3}
                        maxLength={500}
                        required
                      />
                    </label>
                    <p className="fine muted">
                      Undo all active payments first. This preserves the opening
                      and posts its opposite; create a corrected debt
                      separately.
                    </p>
                    <SubmitButton secondary>
                      Confirm debt opening reversal
                    </SubmitButton>
                  </form>
                </details>
              )}
            </section>
          );
        })}
      </div>
      {!debts.length && (
        <Empty title="Know what you owe">
          Record obligations to include upcoming minimums in your cash plan.
        </Empty>
      )}
      <section className="panel">
        <h2>Compare repayment strategies</h2>
        <form method="get" className="inline-form">
          <label>
            Currency
            <select name="currency" defaultValue={currency}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Extra monthly payment
            <input
              name="extra"
              inputMode="decimal"
              defaultValue={q.extra || "0"}
            />
          </label>
          <button className="secondary">Compare scenarios</button>
        </form>
        <div className="form-row">
          {comparison.map((s, i) => (
            <div className="scenario" key={i}>
              <h3>
                {i === 0
                  ? "Avalanche · highest rate first"
                  : "Snowball · smallest balance first"}
              </h3>
              <p>
                {s.complete
                  ? s.months + " months to repay"
                  : "Not repaid within 100 years at this payment level"}
              </p>
              <p className="fine">
                {s.complete ? "Estimated" : "Simulated"} interest:{" "}
                {formatMoney(s.interest, currency)}
              </p>
            </div>
          ))}
        </div>
        <p className="fine muted">
          Illustrative estimates: fixed rates, monthly compounding, month-end
          payments, unchanged total monthly payment budget and no new borrowing.
          Contracts, daily interest, penalties and rate changes may differ.
          Currencies are compared separately.
        </p>
      </section>
      <PaymentUndo
        rows={payments.filter((p) => p.kind === "debt")}
        today={today}
      />
    </Shell>
  );
}
