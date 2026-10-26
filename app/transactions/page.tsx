import Shell, { Notice, Empty } from "@/components/shell";
import { Filters } from "@/components/filters";
import { baseData, journal, localMonth, localDate } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import Decimal from "decimal.js";
import {
  postEntry,
  addCategory,
  reverseEntry,
  renameCategory,
} from "../actions";
export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    scope?: string;
    q?: string;
    error?: string;
    notice?: string;
  }>;
}) {
  const { accounts, categories, profile } = await baseData();
  const q = await searchParams;
  const month = q.month || localMonth(profile?.timezone);
  const scope = ["personal", "business"].includes(q.scope || "")
    ? q.scope!
    : "all";
  const rows = await journal(month, scope);
  const seen = new Set<string>();
  const entries = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  const shown = entries.filter((r) =>
    (
      r.description +
      " " +
      (categories.find((c) => c.id === r.category_id)?.name || "")
    )
      .toLowerCase()
      .includes((q.q || "").toLowerCase()),
  );
  const today = localDate(profile?.timezone);
  const active = accounts.filter((a) => !a.archived);
  return (
    <Shell
      active="/transactions"
      title="Transactions"
      subtitle="Every inflow, outflow and move in between."
    >
      <Notice error={q.error} notice={q.notice} />
      <details className="panel entry-panel" id="new" open>
        <summary>
          Record a transaction <span>＋</span>
        </summary>
        {!active.length ? (
          <p>Add an account first, then create a category below.</p>
        ) : (
          <form action={postEntry}>
            <input type="hidden" name="key" value={crypto.randomUUID()} />
            <div className="form-grid">
              <label>
                Type
                <select name="kind">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                  <option value="refund">Refund</option>
                </select>
              </label>
              <label>
                Account
                <select name="account">
                  {active.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency} · {a.scope}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  pattern="[0-9]+(\.[0-9]+)?"
                  required
                />
              </label>
              <label>
                Date
                <input name="date" type="date" defaultValue={today} required />
              </label>
              <label>
                Category (income / expense)
                <select name="category">
                  <option value="">Choose category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.kind} · {c.scope}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination (transfers only)
                <select name="destination">
                  <option value="">Choose account</option>
                  {active.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Original expense (refunds only)
                <input name="related" placeholder="Paste the expense ID" />
              </label>
              <label>
                Description
                <input
                  name="description"
                  maxLength={500}
                  placeholder="What was it for?"
                />
              </label>
            </div>
            <p className="muted fine">
              Transfers support the same currency. For refunds, copy an expense
              ID from its details below. Unused fields are ignored.
              Foreign-currency transfers require a later FX workflow.
            </p>
            <button>Save transaction</button>
          </form>
        )}
      </details>
      <details className="panel">
        <summary>Create a category</summary>
        <form action={addCategory} className="inline-form">
          <label>
            Name
            <input
              name="name"
              placeholder="e.g. Groceries"
              maxLength={80}
              required
            />
          </label>
          <label>
            Type
            <select name="kind">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            Scope
            <select name="scope">
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </label>
          <button>Add category</button>
        </form>
      </details>
      <details className="panel">
        <summary>Edit category names</summary>
        {categories.length ? (
          categories.map((c) => (
            <form action={renameCategory} className="inline-form" key={c.id}>
              <input type="hidden" name="id" value={c.id} />
              <label>
                {c.kind} · {c.scope}
                <input
                  name="name"
                  aria-label={"Rename " + c.name}
                  defaultValue={c.name}
                  maxLength={80}
                  required
                />
              </label>
              <button className="secondary">Rename</button>
            </form>
          ))
        ) : (
          <p>No categories yet.</p>
        )}
      </details>
      <Filters month={month} scope={scope} search />
      <section className="panel">
        <div className="section-heading">
          <h2>Transaction history</h2>
          <span className="pill">{shown.length} entries</span>
        </div>
        {shown.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Scope / type</th>
                  <th>Amount</th>
                  <th>Details & corrections</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.description || r.kind}</b>
                      <small>
                        {categories.find((c) => c.id === r.category_id)?.name ||
                          "—"}
                      </small>
                    </td>
                    <td>{r.effective_date}</td>
                    <td>
                      {r.scope}
                      <small>{r.kind}</small>
                    </td>
                    <td>
                      {formatMoney(
                        new Decimal(r.amount).abs().toString(),
                        r.currency,
                      )}
                    </td>
                    <td>
                      <details>
                        <summary>Details</summary>
                        <code className="entry-id">{r.id}</code>
                        {r.related_entry && (
                          <small>Related: {r.related_entry}</small>
                        )}
                        {r.kind !== "reversal" && (
                          <form action={reverseEntry}>
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              type="hidden"
                              name="key"
                              value={crypto.randomUUID()}
                            />
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
                              <input
                                name="reason"
                                minLength={3}
                                maxLength={500}
                                required
                              />
                            </label>
                            <p className="fine">
                              This preserves the original and posts an opposite
                              entry. Add a replacement separately if needed.
                            </p>
                            <button className="secondary">
                              Confirm reversal
                            </button>
                          </form>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No transactions in this view">
            Record a transaction or choose another month.
          </Empty>
        )}
      </section>
    </Shell>
  );
}
