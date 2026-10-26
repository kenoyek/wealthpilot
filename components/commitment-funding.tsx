"use client";
import { useState, useSyncExternalStore } from "react";
import type { Account, Category } from "@/lib/data";
import type { Goal } from "@/lib/planning-data";
const subscribe = () => () => {};
export function CommitmentFunding({
  accounts,
  categories,
  goals,
}: {
  accounts: Account[];
  categories: Category[];
  goals: Goal[];
}) {
  const active = accounts.filter((a) => !a.archived);
  const [account, setAccount] = useState(active[0]?.id || "");
  const selected = active.find((a) => a.id === account);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className="funding-fields">
      <label>
        Funding account
        <select
          name="account"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          disabled={!ready}
          required
        >
          {active.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency} · {a.scope}
            </option>
          ))}
        </select>
      </label>
      <label>
        Expense category
        <select
          name="category"
          key={account + "-category"}
          disabled={!ready}
          required
        >
          <option value="">Choose an expense category</option>
          {categories
            .filter((c) => c.kind === "expense" && c.scope === selected?.scope)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.scope}
              </option>
            ))}
        </select>
      </label>
      <label>
        Covered by reserve (optional)
        <select name="reserve" key={account + "-reserve"} disabled={!ready}>
          <option value="">No linked reserve</option>
          {goals
            .filter((g) => !g.archived && g.account_id === account)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
        <small className="muted">
          Only reserves on this funding account are shown.
        </small>
      </label>
    </div>
  );
}
