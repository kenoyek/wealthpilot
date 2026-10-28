import Link from "next/link";
import Shell, { Notice, Empty } from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
import { RecurringFields } from "@/components/recurring-fields";
import { baseData, localDate } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import {
  saveRecurring,
  toggleRecurring,
  resolveRecurring,
} from "../tools-actions";
interface Template {
  id: string;
  account_id: string;
  category_id: string;
  name: string;
  kind: string;
  amount: string;
  description: string;
  cadence: string;
  next_due: string;
  active: boolean;
  revision: string;
}
export default async function Recurring({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { client, accounts, categories, profile } = await baseData();
  const [t, h] = await Promise.all([
    client.from("recurring_values").select("*").order("next_due"),
    client
      .from("recurring_occurrences")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (t.error || h.error)
    throw new Error("Unable to load recurring schedules. Please retry.");
  const templates = (t.data || []) as Template[];
  const today = localDate(profile?.timezone),
    activeAccounts = accounts.filter((a) => !a.archived);
  function fields(template?: Template) {
    return (
      <>
        <input type="hidden" name="key" value={crypto.randomUUID()} />
        {template && (
          <>
            <input type="hidden" name="id" value={template.id} />
            <input type="hidden" name="revision" value={template.revision} />
          </>
        )}
        <div className="form-grid">
          <label>
            Schedule name
            <input
              name="name"
              maxLength={80}
              defaultValue={template?.name}
              required
            />
          </label>
          <RecurringFields
            accounts={activeAccounts}
            categories={categories}
            initial={template}
          />
          <label>
            Amount per occurrence
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={template?.amount}
              required
            />
          </label>
          <label>
            Repeat
            <select
              aria-label="Repeat"
              name="cadence"
              defaultValue={template?.cadence || "monthly"}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            Next due date
            <input
              name="date"
              type="date"
              defaultValue={template?.next_due || today}
              required
            />
          </label>
          <label>
            Transaction description
            <input
              name="description"
              maxLength={500}
              defaultValue={template?.description}
            />
          </label>
        </div>
        <SubmitButton>
          {template ? "Save schedule changes" : "Create schedule"}
        </SubmitButton>
      </>
    );
  }
  return (
    <Shell
      active="/transactions"
      title="Recurring transactions"
      subtitle="Less repetition. Every transaction stays in your control."
    >
      <Notice {...await searchParams} />
      <div className="quick-actions">
        <Link href="/transactions">All transactions ↗</Link>
        <Link href="/transactions/import">Import CSV ↗</Link>
        <Link href="/planning/commitments">Bills & subscriptions ↗</Link>
      </div>
      <p className="notice">
        Schedules are shortcuts, not automatic payments. Confirm each occurrence
        only when money actually moves. They do not reserve money or add unpaid
        bills to forecasts; use Bills & subscriptions for that, and record each
        payment once.
      </p>
      <details className="panel" open={!templates.length}>
        <summary>Add a recurring schedule</summary>
        {activeAccounts.length ? (
          <form action={saveRecurring}>{fields()}</form>
        ) : (
          <Empty title="Start with an account">
            <Link href="/accounts">Add an account →</Link>
          </Empty>
        )}
      </details>
      <div className="goal-grid">
        {templates.map((t) => {
          const account = accounts.find((a) => a.id === t.account_id)!;
          return (
            <section className="panel" key={`${t.id}-${t.revision}`}>
              <div className="section-heading">
                <div>
                  <h2>{t.name}</h2>
                  <p>
                    {account.name} · {t.kind} · {t.cadence}
                  </p>
                </div>
                <span className="pill">
                  {!t.active
                    ? "Paused"
                    : t.next_due < today
                      ? "Overdue"
                      : t.next_due === today
                        ? "Due today"
                        : "Upcoming"}
                </span>
              </div>
              <strong className="planning-amount">
                {formatMoney(t.amount, account.currency)}
              </strong>
              <p>Next due: {t.next_due}</p>
              {t.active && (
                <form action={resolveRecurring}>
                  <input type="hidden" name="key" value={crypto.randomUUID()} />
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="revision" value={t.revision} />
                  <input type="hidden" name="due" value={t.next_due} />
                  <label>
                    Actual transaction date
                    <input
                      name="date"
                      type="date"
                      max={today}
                      defaultValue={today}
                      required
                    />
                  </label>
                  <p className="fine muted">
                    Confirming records {formatMoney(t.amount, account.currency)}{" "}
                    in {account.name} and advances one occurrence. Skip advances
                    the date without posting. Reverse mistakes in Transactions;
                    reversing does not rewind the schedule.
                  </p>
                  <SubmitButton
                    name="mode"
                    value="post"
                    pendingLabel="Recording…"
                  >
                    Confirm actual transaction
                  </SubmitButton>{" "}
                  <SubmitButton
                    name="mode"
                    value="skip"
                    secondary
                    pendingLabel="Skipping…"
                  >
                    Skip occurrence
                  </SubmitButton>
                </form>
              )}
              <form action={toggleRecurring}>
                <input type="hidden" name="key" value={crypto.randomUUID()} />
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="revision" value={t.revision} />
                <input
                  type="hidden"
                  name="active"
                  value={t.active ? "false" : "true"}
                />
                <SubmitButton secondary>
                  {t.active ? "Pause schedule" : "Resume schedule"}
                </SubmitButton>
              </form>
              <details>
                <summary>Edit schedule</summary>
                <form action={saveRecurring}>{fields(t)}</form>
              </details>
            </section>
          );
        })}
      </div>
      <section className="panel">
        <h2>Recent occurrences</h2>
        {h.data?.length ? (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Recurring occurrence history"
          >
            <table>
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Due date</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {h.data.map((o) => (
                  <tr key={o.id}>
                    <td>
                      {templates.find((t) => t.id === o.template_id)?.name ||
                        "Schedule"}
                    </td>
                    <td>{o.due_date}</td>
                    <td>
                      {o.skipped
                        ? "Skipped — no money moved"
                        : "Recorded — see Transactions for reversals"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Confirmed and skipped occurrences will appear here.</p>
        )}
      </section>
    </Shell>
  );
}
