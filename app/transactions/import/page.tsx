import Link from "next/link";
import Shell, { Notice, Empty } from "@/components/shell";
import { ImportForm } from "@/components/import-form";
import { SubmitButton } from "@/components/submit-button";
import { baseData, localDate } from "@/lib/data";
import { undoImport } from "../tools-actions";
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { client, accounts, categories, profile } = await baseData();
  const { data: batches, error } = await client
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error("Unable to load import history. Please retry.");
  const active = accounts.filter((a) => !a.archived);
  const today = localDate(profile?.timezone);
  return (
    <Shell
      active="/transactions"
      title="Import transactions"
      subtitle="Bring your records together, with a review before anything changes."
    >
      <Notice {...await searchParams} />
      <div className="quick-actions">
        <Link href="/transactions">All transactions ↗</Link>
        <Link href="/transactions/recurring">Recurring schedules ↗</Link>
        <a href="/wealthpilot-import-template.csv" download>
          Download CSV template ↓
        </a>
      </div>
      <section className="panel">
        <h2>Upload, review, confirm</h2>
        <p>
          Convert your bank export to the WealthPilot CSV template first. Import
          income and expenses in a single currency/account. Transfers, refunds
          and opening balances belong in the regular transaction form.
        </p>
        {active.length ? (
          <ImportForm
            accounts={active}
            categories={categories}
            requestKey={crypto.randomUUID()}
          />
        ) : (
          <Empty title="Add an account first">
            <Link href="/accounts">Create an account to import into →</Link>
          </Empty>
        )}
      </section>
      <section className="panel">
        <h2>How duplicate protection works</h2>
        <p>
          A reference identifies a transaction within the selected account.
          Without a reference, date, type, normalized amount and description
          identify it. Re-uploading the same records skips them, even if you
          choose a different category. A reference with changed details blocks
          the import for review.
        </p>
        <p className="fine muted">
          Checks cover CSV imports, not separately entered manual transactions
          or recurring confirmations. Two legitimate identical transactions need
          different references. Undo keeps duplicate protection; use the regular
          transaction form for a corrected replacement. Previewing does not post
          entries. Confirmed imports are atomic: an invalid row leaves the whole
          batch unchanged.
        </p>
      </section>
      <section className="panel">
        <h2>Recent imports</h2>
        {batches?.length ? (
          batches.map((b) => (
            <div className="payment-item" key={b.id}>
              <h3>
                {accounts.find((a) => a.id === b.account_id)?.name || "Account"}
              </h3>
              <p>
                {b.imported} imported · {b.skipped} skipped ·{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: profile?.timezone || "Africa/Lagos",
                }).format(new Date(b.created_at))}{" "}
                {b.undone ? "· Undone" : ""}
              </p>
              {!b.undone && b.imported > 0 && (
                <details>
                  <summary>Undo this import</summary>
                  <p>
                    Reverse all entries from this batch that have not already
                    been reversed. The original entries remain in your journal
                    for a clear audit trail. If an imported expense has a
                    refund, reverse the refund first.
                  </p>
                  <form action={undoImport}>
                    <input type="hidden" name="batch" value={b.id} />
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
                        max={today}
                        defaultValue={today}
                        required
                      />
                    </label>
                    <SubmitButton secondary pendingLabel="Undoing…">
                      Confirm undo import
                    </SubmitButton>
                  </form>
                </details>
              )}
            </div>
          ))
        ) : (
          <p>No imports yet. Your confirmed batches will appear here.</p>
        )}
      </section>
    </Shell>
  );
}
