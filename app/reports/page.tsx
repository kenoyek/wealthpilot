import Shell from "@/components/shell";
import { Filters } from "@/components/filters";
import { baseData, journal, localMonth } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { totals, categorySpending, cashMovement } from "@/lib/summary";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const { categories, profile } = await baseData();
  const q = await searchParams;
  const month = q.month || localMonth(profile?.timezone);
  const scope = ["personal", "business"].includes(q.scope || "")
    ? q.scope!
    : "all";
  const rows = await journal(month, scope);
  const currencies = [...new Set(rows.map((r) => r.currency))];
  return (
    <Shell
      active="/reports"
      title="Financial reports"
      subtitle="See the patterns. Make your next decision with confidence."
    >
      <Filters month={month} scope={scope} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Monthly cash statement</h2>
            <p>Cash basis · effective dates · transfers excluded</p>
          </div>
          <a
            className="button secondary"
            href={"/api/export?month=" + month + "&scope=" + scope}
          >
            Export CSV ↓
          </a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Currency</th>
                <th>Income</th>
                <th>Net expenses</th>
                <th>Operating surplus</th>
                <th>Net cash movement</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => {
                const t = totals(rows, c);
                return (
                  <tr key={c}>
                    <td>{c}</td>
                    <td>{formatMoney(t.income, c)}</td>
                    <td>{formatMoney(t.expenses, c)}</td>
                    <td>{formatMoney(t.net, c)}</td>
                    <td>{formatMoney(cashMovement(rows, c), c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!currencies.length && (
          <p className="empty">No posted entries for this period.</p>
        )}
        <p className="muted fine">
          Currencies are reported separately. No current exchange rate is
          applied to historical records. Debt principal affects cash movement
          but not expenses; operating surplus is income minus expenses. Opening
          balances and their reversals are excluded from cash movement. This is
          a personal planning statement, not a verified tax filing.
        </p>
      </section>
      <section className="panel">
        <h2>Expense breakdown</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Scope</th>
                {currencies.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories
                .filter(
                  (c) =>
                    c.kind === "expense" &&
                    (scope === "all" || c.scope === scope),
                )
                .map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.scope}</td>
                    {currencies.map((code) => (
                      <td key={code}>
                        {formatMoney(
                          categorySpending(rows, c.id, code).toString(),
                          code,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
