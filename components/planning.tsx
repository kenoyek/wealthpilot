import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Account } from "@/lib/data";
import type { Goal } from "@/lib/planning-data";
import { undoPayment } from "@/app/planning/actions";
import { SubmitButton } from "./submit-button";
export function PlanningNav() {
  return (
    <nav className="planning-tabs" aria-label="Financial planning">
      <Link href="/planning">Cash & reminders</Link>
      <Link href="/insights">Insights & forecasts</Link>
      <Link href="/planning/goals">Savings goals</Link>
      <Link href="/planning/allocate">Income allocation</Link>
      <Link href="/planning/commitments">Bills & subscriptions</Link>
      <Link href="/planning/debts">Debts</Link>
    </nav>
  );
}
export function RequestKey() {
  return <input type="hidden" name="key" value={crypto.randomUUID()} />;
}
export function AccountSelect({ accounts }: { accounts: Account[] }) {
  return (
    <label>
      Funding account
      <select name="account" required>
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency} · {a.scope}
            </option>
          ))}
      </select>
    </label>
  );
}
export function ReserveSelect({ goals }: { goals: Goal[] }) {
  return (
    <label>
      Covered by reserve (optional)
      <select name="reserve">
        <option value="">No linked reserve</option>
        {goals
          .filter((g) => !g.archived)
          .map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
      </select>
      <small className="muted">
        Choose a goal on the same account. Shared reserves are counted once.
      </small>
    </label>
  );
}
export interface PaymentHistoryRow {
  id: string;
  kind: string;
  entity_id: string;
  entry_id: string;
  due_date: string;
  undone_entry: string | null;
  description: string;
  effective_date: string;
  currency: string;
  amount: string;
  principal: string;
  interest: string;
}
export function PaymentUndo({
  rows,
  today,
}: {
  rows: PaymentHistoryRow[];
  today: string;
}) {
  return (
    <details className="panel">
      <summary>Recent payments & corrections</summary>
      <p className="fine muted">
        Latest 30 planning payments. Undo the newest payment first. Reversals
        preserve the original ledger record.
      </p>
      {rows.length ? (
        rows.map((p) => (
          <div className="payment-item" key={p.id}>
            <h3>
              {p.description} · {formatMoney(p.amount, p.currency)}
            </h3>
            <p className="fine muted">Recorded for {p.effective_date}</p>
            <p>
              Due {p.due_date} · {p.undone_entry ? "reversed" : "recorded"}
            </p>
            {!p.undone_entry && (
              <form action={undoPayment} className="inline-form">
                <RequestKey />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="kind" value={p.kind} />
                <label>
                  Reversal date
                  <input
                    name="date"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={3} maxLength={500} required />
                </label>
                <SubmitButton secondary>Confirm payment undo</SubmitButton>
              </form>
            )}
          </div>
        ))
      ) : (
        <p>No payments yet.</p>
      )}
    </details>
  );
}
