"use client";
import { useActionState, useSyncExternalStore, useState } from "react";
import type { Account, Category } from "@/lib/data";
import { postEntry } from "@/app/actions";
import { SubmitButton } from "./submit-button";
const subscribe = () => () => {};
export function TransactionForm({
  accounts,
  categories,
  today,
  requestKey,
  initialKind = "expense",
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
  requestKey: string;
  initialKind?: string;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [kind, setKind] = useState(initialKind);
  const [account, setAccount] = useState(accounts[0]?.id || "");
  const [key, setKey] = useState(requestKey);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [destination, setDestination] = useState("");
  const [related, setRelated] = useState("");
  const [result, formAction, pending] = useActionState<
    { error?: string; notice?: string },
    FormData
  >(async (_previous, data) => {
    const outcome = await postEntry(data);
    if (outcome.notice) {
      setKey(crypto.randomUUID());
      setAmount("");
      setDescription("");
      setCategory("");
      setDestination("");
      setRelated("");
    }
    return outcome;
  }, {});
  const selected = accounts.find((a) => a.id === account);
  const available = categories.filter(
    (c) => c.kind === kind && c.scope === selected?.scope,
  );
  return (
    <form action={formAction}>
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
      <input type="hidden" name="key" value={key} />
      <fieldset disabled={!ready || pending} className="transaction-fields">
        <div className="form-grid">
          <label>
            Type
            <select
              name="kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setCategory("");
              }}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
              <option value="refund">Refund</option>
            </select>
          </label>
          <label>
            Account
            <select
              name="account"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setCategory("");
                setDestination("");
              }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency} · {a.scope}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount{selected ? ` (${selected.currency})` : ""}
            <input
              aria-label="Amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              pattern="[0-9]+(\.[0-9]+)?"
              required
            />
          </label>
          <label>
            Date
            <input
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          {(kind === "expense" || kind === "income") && (
            <label>
              Category (income / expense)
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Choose category</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.kind} · {c.scope}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "transfer" && (
            <label>
              Destination (transfers only)
              <select
                name="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              >
                <option value="">Choose account</option>
                {accounts
                  .filter(
                    (a) =>
                      a.id !== account && a.currency === selected?.currency,
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {kind === "refund" && (
            <label>
              Original expense (refunds only)
              <input
                name="related"
                value={related}
                onChange={(e) => setRelated(e.target.value)}
                required
                placeholder="Paste the expense ID"
              />
            </label>
          )}
          <label>
            Description
            <input
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What was it for?"
            />
          </label>
        </div>
        <p className="muted fine">
          {kind === "transfer"
            ? "Move money between your accounts in the same currency. Transfers do not count as income or spending."
            : kind === "refund"
              ? "Copy the original expense ID from its details below. Refunds reduce spending rather than adding income."
              : `Choose a ${selected?.scope || "personal"} ${kind} category. Your balances and reports update together.`}
        </p>
        <SubmitButton>Save transaction</SubmitButton>
      </fieldset>
    </form>
  );
}
