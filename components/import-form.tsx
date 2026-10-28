"use client";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import type { Account, Category } from "@/lib/data";
import { maxCsvBytes } from "@/lib/import-csv";
import {
  processImport,
  type ImportReview,
} from "@/app/transactions/tools-actions";
import { formatMoney, sum } from "@/lib/money";
import { SubmitButton } from "./submit-button";
const subscribe = () => () => {};
export function ImportForm({
  accounts,
  categories,
  requestKey,
}: {
  accounts: Account[];
  categories: Category[];
  requestKey: string;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [account, setAccount] = useState(accounts[0]?.id || "");
  const [income, setIncome] = useState("");
  const [expense, setExpense] = useState("");
  const [text, setText] = useState("");
  const [key, setKey] = useState(requestKey);
  const [preview, setPreview] = useState<ImportReview | null>(null);
  const [fileError, setFileError] = useState("");
  const readSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, action, pending] = useActionState<
    { error?: string; notice?: string },
    FormData
  >(async (_previous, data) => {
    const outcome = await processImport(data);
    if (outcome.preview) setPreview(outcome.preview);
    if (outcome.notice) {
      setPreview(null);
      setText("");
      setKey(crypto.randomUUID());
      if (fileInput.current) fileInput.current.value = "";
    }
    return outcome;
  }, {});
  const selected = accounts.find((a) => a.id === account);
  const available = categories.filter((c) => c.scope === selected?.scope);
  const reset = () => {
    setPreview(null);
    setKey(crypto.randomUUID());
  };
  return (
    <form action={action} onReset={(event) => event.preventDefault()}>
      {result.error && (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}
      {result.notice && (
        <p className="notice" role="status">
          {result.notice}
        </p>
      )}
      {fileError && (
        <p className="error" role="alert">
          {fileError}
        </p>
      )}
      <input type="hidden" name="key" value={key} />
      <fieldset className="transaction-fields" disabled={!ready || pending}>
        <div className="form-grid">
          <label>
            Import into account
            <select
              aria-label="Import into account"
              name="account"
              value={account}
              onChange={(e) => {
                reset();
                setAccount(e.target.value);
                setIncome("");
                setExpense("");
              }}
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency} · {a.scope}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category for expenses
            <select
              aria-label="Category for expenses"
              name="expense_category"
              value={expense}
              onChange={(e) => {
                reset();
                setExpense(e.target.value);
              }}
            >
              <option value="">Choose if your file has expenses</option>
              {available
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Category for income
            <select
              aria-label="Category for income"
              name="income_category"
              value={income}
              onChange={(e) => {
                reset();
                setIncome(e.target.value);
              }}
            >
              <option value="">Choose if your file has income</option>
              {available
                .filter((c) => c.kind === "income")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          Choose a CSV file
          <input
            type="file"
            ref={fileInput}
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const sequence = ++readSequence.current;
              reset();
              setFileError("");
              setText("");
              if (!file) return;
              if (file.size > maxCsvBytes) {
                setFileError("Use a file of at most 256 KiB.");
                return;
              }
              try {
                const content = new TextDecoder("utf-8", {
                  fatal: true,
                }).decode(await file.arrayBuffer());
                if (sequence === readSequence.current) setText(content);
              } catch {
                if (sequence === readSequence.current)
                  setFileError(
                    "Unable to read this file. Save it as UTF-8 CSV and try again.",
                  );
              }
            }}
          />
        </label>
        <label>
          CSV contents
          <textarea
            name="csv"
            rows={7}
            value={text}
            onChange={(e) => {
              readSequence.current++;
              reset();
              setFileError("");
              setText(e.target.value);
            }}
            required
            aria-describedby="csv-help"
          />
        </label>
        <p id="csv-help" className="fine muted">
          Use date,type,amount,description,reference. Reference is optional.
          Dates: YYYY-MM-DD through today. Types: income or expense. Amounts:
          positive numbers without symbols or thousands separators. Choose a
          category for each type in the file; all rows use this account’s
          currency. At most 200 rows and 256 KiB per import.
        </p>
        {preview ? (
          <>
            <section
              className="import-preview"
              aria-labelledby="import-review-title"
            >
              <h3 id="import-review-title">Review your import</h3>
              <p>
                {preview.imported} new transaction(s) · {preview.skipped}{" "}
                duplicate(s) will be skipped. Your balances have not changed.
              </p>
              <dl className="forecast-breakdown">
                {(["income", "expense"] as const).map((kind) => (
                  <div key={kind}>
                    <dt>New {kind === "income" ? "income" : "expenses"}</dt>
                    <dd>
                      {formatMoney(
                        sum(
                          preview.rows
                            .filter(
                              (r) => r.status === "new" && r.kind === kind,
                            )
                            .map((r) => r.amount),
                        ),
                        selected!.currency,
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="fine muted">
                Scroll the table horizontally to review every column on a small
                screen.
              </p>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="CSV preview table"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{r.kind}</td>
                        <td>{formatMoney(r.amount, selected!.currency)}</td>
                        <td>{r.status}</td>
                        <td>{r.date}</td>
                        <td>{r.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {preview.imported > 0 ? (
              <SubmitButton
                name="mode"
                value="commit"
                pendingLabel="Importing…"
              >
                Confirm import
              </SubmitButton>
            ) : (
              <p className="notice">
                Nothing new to import. These rows are already present in an
                import or repeat earlier rows in this file.
              </p>
            )}
            <button className="secondary" type="button" onClick={reset}>
              Cancel preview
            </button>
          </>
        ) : (
          <SubmitButton
            name="mode"
            value="preview"
            pendingLabel="Checking rows…"
          >
            Preview import
          </SubmitButton>
        )}
      </fieldset>
    </form>
  );
}
