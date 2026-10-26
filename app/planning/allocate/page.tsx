import Decimal from "decimal.js";
import Shell, { Notice } from "@/components/shell";
import { PlanningNav, RequestKey } from "@/components/planning";
import { SubmitButton } from "@/components/submit-button";
import { planningData } from "@/lib/planning-data";
import { formatMoney } from "@/lib/money";
import { allocationPreview } from "@/lib/planning";
import {
  confirmAllocation,
  undoAllocation,
  saveAllocationTemplate,
} from "../actions";
interface Receipt {
  id: string;
  description: string;
  effective_date: string;
  currency: string;
  account_id: string;
  amount: string;
  unallocated: string;
}
export default async function Allocate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { client, accounts, goals, positions } = await planningData();
  const q = await searchParams;
  const [income, batches, templates] = await Promise.all([
    client
      .from("received_income")
      .select("*")
      .order("effective_date", { ascending: false })
      .limit(100),
    client
      .from("allocation_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    client.from("allocation_templates").select("*").order("name"),
  ]);
  if (income.error || batches.error || templates.error)
    throw new Error("Unable to load received income.");
  const receipts = income.data as Receipt[];
  const receipt = receipts.find((r) => r.id === q.entry) || receipts[0];
  const eligible = receipt
    ? goals
        .filter((g) => !g.archived && g.account_id === receipt.account_id)
        .slice(0, 50)
    : [];
  const p = receipt ? positions[receipt.account_id] : null;
  const preset = templates.data?.find(
    (t) => t.id === q.template && t.account_id === receipt?.account_id,
  );
  const weight = (id: string) =>
    q["weight_" + id] ??
    (preset?.weights as { id: string; weight: string }[] | undefined)?.find(
      (w) => w.id === id,
    )?.weight ??
    "0";
  let error = q.error;
  let preview: ReturnType<typeof allocationPreview> | null = null;
  if (q.preview && receipt && p) {
    try {
      preview = allocationPreview(
        p.safe,
        receipt.unallocated,
        eligible.map((g) => ({
          id: g.id,
          weight: weight(g.id),
          remaining: new Decimal(g.target).minus(g.funded).toString(),
        })),
        receipt.currency,
      );
    } catch (e) {
      error = e instanceof Error ? e.message : "Invalid allocation.";
    }
  }
  return (
    <Shell
      active="/planning"
      title="Give income a plan"
      subtitle="Reserve what you need before deciding what comes next."
    >
      <PlanningNav />
      <Notice error={error} notice={q.notice} />
      <section className="panel">
        <h2>Choose received income</h2>
        {receipts.length ? (
          <form method="get" className="inline-form">
            <label>
              Income receipt
              <select name="entry" defaultValue={receipt?.id}>
                {receipts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.effective_date} · {r.description || "Income"} ·{" "}
                    {formatMoney(r.amount, r.currency)}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary">Choose income</button>
          </form>
        ) : (
          <p>
            Record an income transaction first. Unpaid invoices and expected
            client payments cannot fund allocations.
          </p>
        )}
        <p className="fine muted">
          Latest 100 unreversed income receipts. Allocation earmarks cash
          virtually and never initiates a bank transfer.
        </p>
      </section>
      {receipt && p && (
        <>
          <section className="panel">
            <h2>Protect essentials first</h2>
            <div className="stats">
              {[
                ["Income left to allocate", receipt.unallocated],
                ["Account cash", p.cash],
                ["Already earmarked", p.reserved],
                ["Uncovered 30-day obligations", p.uncovered],
              ].map(([label, value]) => (
                <div className="stat" key={label}>
                  <p>{label}</p>
                  <b>{formatMoney(value, receipt.currency)}</b>
                </div>
              ))}
            </div>
            <p>
              Conservative capacity:{" "}
              <b>
                {formatMoney(
                  Decimal.max(
                    0,
                    Decimal.min(p.safe, receipt.unallocated),
                  ).toString(),
                  receipt.currency,
                )}
              </b>
            </p>
            <p className="fine muted">
              Uses cash actually received in{" "}
              {accounts.find((a) => a.id === receipt.account_id)?.name},
              existing earmarks and recorded near-term commitments. No future
              freelance income is assumed.
            </p>
            {!goals.some(
              (g) =>
                g.account_id === receipt.account_id && g.kind === "emergency",
            ) ? (
              <p className="notice">
                No emergency reserve is recorded on this account. Consider your
                essential-spending buffer before allocating to other goals.
              </p>
            ) : (
              goals
                .filter(
                  (g) =>
                    g.account_id === receipt.account_id &&
                    g.kind === "emergency",
                )
                .map((g) => (
                  <p className="notice" key={g.id}>
                    {g.name}: {formatMoney(g.funded, receipt.currency)} funded;{" "}
                    {new Decimal(g.essential_monthly).gt(0)
                      ? new Decimal(g.funded)
                          .div(g.essential_monthly)
                          .toFixed(1) + " months of essential spending"
                      : "coverage unknown until you add a spending baseline"}
                    .
                  </p>
                ))
            )}
          </section>
          <section className="panel">
            <h2>Set your allocation percentages</h2>
            {templates.data?.some(
              (t) => t.account_id === receipt.account_id,
            ) && (
              <form method="get" className="inline-form">
                <input type="hidden" name="entry" value={receipt.id} />
                <label>
                  Saved percentage template
                  <select name="template" defaultValue={q.template || ""}>
                    <option value="">Choose a template</option>
                    {templates.data
                      .filter((t) => t.account_id === receipt.account_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="secondary">Use percentage template</button>
              </form>
            )}

            <p className="fine muted">
              Choose percentages from your own priorities and income volatility.
              They must total 100%. Target caps leave excess unassigned; it is
              not silently redistributed.
            </p>
            {eligible.length ? (
              <form method="get">
                <input type="hidden" name="entry" value={receipt.id} />
                <input type="hidden" name="preview" value="1" />
                <input type="hidden" name="template" value={q.template || ""} />
                {eligible.map((g) => (
                  <label key={g.id}>
                    {g.name} · priority {g.priority} ·{" "}
                    {formatMoney(
                      new Decimal(g.target).minus(g.funded).toString(),
                      receipt.currency,
                    )}{" "}
                    to target
                    <input
                      name={"weight_" + g.id}
                      aria-label={g.name + " percentage"}
                      inputMode="decimal"
                      defaultValue={weight(g.id)}
                      required
                    />
                  </label>
                ))}
                <button className="secondary">Preview allocation</button>
              </form>
            ) : (
              <p>Create an unfunded goal on this income account first.</p>
            )}
          </section>
          {preview && (
            <section className="panel">
              <h2>Review before confirming</h2>
              <details>
                <summary>Save these percentages for future income</summary>
                <form action={saveAllocationTemplate}>
                  <RequestKey />
                  <input
                    type="hidden"
                    name="account"
                    value={receipt.account_id}
                  />
                  <input type="hidden" name="entry" value={receipt.id} />
                  <input
                    type="hidden"
                    name="weights"
                    value={JSON.stringify(
                      eligible.map((g) => ({ id: g.id, weight: weight(g.id) })),
                    )}
                  />
                  <label>
                    Template name
                    <input name="name" maxLength={80} required />
                  </label>
                  <p className="fine muted">
                    Saving the same name on this account replaces its
                    percentages. Every future allocation still needs a fresh
                    preview and confirmation.
                  </p>
                  <SubmitButton secondary>
                    Save percentage template
                  </SubmitButton>
                </form>
              </details>

              <ul>
                {preview.plan.map((item) => (
                  <li key={item.goal}>
                    {goals.find((g) => g.id === item.goal)?.name}:{" "}
                    {formatMoney(item.amount, receipt.currency)}
                  </li>
                ))}
              </ul>
              <p className="fine muted">
                Unassigned from capacity:{" "}
                {formatMoney(preview.unassigned, receipt.currency)}. Live funds
                and obligations are checked again at confirmation.
              </p>
              {preview.plan.length ? (
                <form action={confirmAllocation}>
                  <RequestKey />
                  <input type="hidden" name="entry" value={receipt.id} />
                  <input
                    type="hidden"
                    name="plan"
                    value={JSON.stringify(preview.plan)}
                  />
                  <SubmitButton>Confirm virtual allocation</SubmitButton>
                </form>
              ) : (
                <p>
                  No available amount to allocate. Review cash, commitments or
                  goal targets.
                </p>
              )}
            </section>
          )}
        </>
      )}
      <details className="panel">
        <summary>Recent allocation batches</summary>
        <p className="fine muted">
          Latest 20 batches. Undo releases the original contributions. If those
          goal funds have since been spent/released, restore sufficient reserves
          before undoing the batch.
        </p>
        {batches.data?.map((b) => (
          <div className="payment-item" key={b.id}>
            <h3>
              {b.description || "Income allocation"} ·{" "}
              {formatMoney(b.amount, b.currency)}
            </h3>
            <p>
              {b.created_at.slice(0, 10)} · {b.undone ? "undone" : "confirmed"}
            </p>
            {!b.undone && (
              <form action={undoAllocation}>
                <RequestKey />
                <input type="hidden" name="id" value={b.id} />
                <SubmitButton secondary>Undo virtual allocation</SubmitButton>
              </form>
            )}
          </div>
        ))}
      </details>
    </Shell>
  );
}
