import { TransactionForm } from "@/components/transaction-form";
import Link from "next/link";
import Shell, { Notice, Empty } from "@/components/shell";
import { Filters } from "@/components/filters";
import { baseData, journal, localMonth, localDate } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import Decimal from "decimal.js";
import { addCategory, reverseEntry, renameCategory } from "../actions";
export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    scope?: string;
    q?: string;
    error?: string;
    notice?: string;
    page?: string;
    entry?: string;
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
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const pageNumber = Math.min(
    pageCount,
    Math.max(1, Number.isSafeInteger(Number(q.page)) ? Number(q.page) : 1),
  );
  const visible = shown.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize,
  );
  const pageHref = (page: number) =>
    "/transactions?" +
    new URLSearchParams({ month, scope, q: q.q || "", page: String(page) });
  const today = localDate(profile?.timezone);
  const active = accounts.filter((a) => !a.archived);
  return (
    <Shell
      active="/transactions"
      title="Transactions"
      subtitle="Every inflow, outflow and move in between."
    >
      <Notice error={q.error} notice={q.notice} />
      <div className="quick-actions">
        <Link href="/transactions/recurring">Recurring schedules ↗</Link>
        <Link href="/transactions/import">Import CSV ↗</Link>
      </div>
      <details className="panel entry-panel" id="new" open>
        <summary>
          Record a transaction <span>＋</span>
        </summary>
        {!active.length ? (
          <p>Add an account first, then create a category below.</p>
        ) : (
          <TransactionForm
            accounts={active}
            categories={categories}
            today={today}
            requestKey={crypto.randomUUID()}
            initialKind={
              ["income", "expense", "transfer", "refund"].includes(
                q.entry || "",
              )
                ? q.entry
                : "expense"
            }
          />
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
      <Filters month={month} scope={scope} search query={q.q || ""} />
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
                {visible.map((r) => (
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
      {pageCount > 1 && (
        <nav className="pagination" aria-label="Transaction pages">
          {pageNumber > 1 && (
            <Link className="button secondary" href={pageHref(pageNumber - 1)}>
              ← Previous
            </Link>
          )}
          <span>
            Page {pageNumber} of {pageCount} · {shown.length} entries
          </span>
          {pageNumber < pageCount && (
            <Link className="button secondary" href={pageHref(pageNumber + 1)}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </Shell>
  );
}
