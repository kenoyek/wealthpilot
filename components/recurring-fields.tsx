"use client";
import { useState, useSyncExternalStore } from "react";
import type { Account, Category } from "@/lib/data";
const subscribe = () => () => {};
export function RecurringFields({
  accounts,
  categories,
  initial,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: { account_id: string; category_id: string; kind: string };
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [account, setAccount] = useState(
    initial?.account_id || accounts[0]?.id || "",
  );
  const [kind, setKind] = useState(initial?.kind || "expense");
  const [category, setCategory] = useState(initial?.category_id || "");
  const selected = accounts.find((a) => a.id === account);
  return (
    <fieldset className="funding-fields" disabled={!ready}>
      <label>
        Type
        <select
          aria-label="Schedule type"
          name="kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setCategory("");
          }}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label>
        Account
        <select
          aria-label="Schedule account"
          name="account"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            setCategory("");
          }}
          required
        >
          <option value="">Choose an account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency} · {a.scope}
            </option>
          ))}
        </select>
      </label>
      <label>
        Category
        <select
          aria-label="Schedule category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="">Choose a matching category</option>
          {categories
            .filter((c) => c.kind === kind && c.scope === selected?.scope)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
    </fieldset>
  );
}
