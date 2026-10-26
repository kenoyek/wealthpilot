import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(
  url || "",
  /^http:\/\/(127\.0\.0\.1|localhost):54321$/,
  "Integration tests require disposable local Supabase, never production.",
);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
async function ok(result) {
  const r = await result;
  assert.equal(r.error, null, r.error?.message);
  return r.data;
}
async function bad(result) {
  const r = await result;
  assert.ok(r.error, "Operation must be rejected");
  return r.error;
}
let a, b, aid, bid, aid2, expense, income, ca, cb;
const date = "2026-10-20";
function post(c, overrides = {}) {
  return c.rpc("post_entry", {
    p_key: randomUUID(),
    p_kind: "expense",
    p_account: aid,
    p_amount: "10.00",
    p_date: date,
    p_description: "Integration fixture",
    p_category: ca,
    ...overrides,
  });
}
test("real database ledger and user isolation", async (t) => {
  a = client();
  b = client();
  for (const c of [a, b]) {
    await ok(
      c.auth.signUp({
        email: `test-${randomUUID()}@example.test`,
        password: randomUUID() + "Ab9!",
      }),
    );
  }
  const au = (await a.auth.getUser()).data.user.id,
    bu = (await b.auth.getUser()).data.user.id;
  aid = await ok(
    a.rpc("create_account", {
      p_name: "Bank A",
      p_currency: "NGN",
      p_scope: "personal",
      p_opening: "1000.00",
    }),
  );
  aid2 = await ok(
    a.rpc("create_account", {
      p_name: "Cash A",
      p_currency: "NGN",
      p_scope: "personal",
    }),
  );
  bid = await ok(
    b.rpc("create_account", {
      p_name: "Bank B",
      p_currency: "NGN",
      p_scope: "personal",
    }),
  );
  ca = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: au,
          name: "Food",
          kind: "expense",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  cb = (
    await ok(
      b
        .from("categories")
        .insert({
          owner_id: bu,
          name: "Food",
          kind: "expense",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  income = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: au,
          name: "Client",
          kind: "income",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  await t.test(
    "exact decimal posting, transfer neutrality and refund",
    async () => {
      await ok(
        post(a, { p_kind: "income", p_category: income, p_amount: "0.10" }),
      );
      await ok(
        post(a, { p_kind: "income", p_category: income, p_amount: "0.20" }),
      );
      expense = await ok(post(a, { p_amount: "30.00" }));
      await ok(
        post(a, {
          p_kind: "transfer",
          p_destination: aid2,
          p_amount: "100.00",
          p_category: null,
        }),
      );
      await ok(
        post(a, {
          p_kind: "refund",
          p_category: null,
          p_related: expense,
          p_amount: "5.00",
        }),
      );
      const balances = await ok(
        a.from("account_balances").select("id,balance"),
      );
      assert.equal(balances.find((x) => x.id === aid).balance, "875.30000000");
      assert.equal(balances.find((x) => x.id === aid2).balance, "100.00000000");
      const lines = await ok(a.from("journal").select("*"));
      assert.equal(
        lines.filter((l) => l.kind === "transfer" && l.bucket !== "asset")
          .length,
        0,
      );
      assert.equal(typeof lines[0].amount, "string");
    },
  );
  await t.test("RLS hides other users and anonymous rows", async () => {
    assert.equal(
      (await ok(b.from("accounts").select("*").eq("id", aid))).length,
      0,
    );
    assert.equal(
      (await ok(b.from("entries").select("*").eq("id", expense))).length,
      0,
    );
    assert.equal(
      (await ok(b.from("journal").select("*").eq("id", expense))).length,
      0,
    );
    assert.equal(
      (await ok(b.from("audit_logs").select("*").eq("entry_id", expense)))
        .length,
      0,
    );
    await bad(
      client().rpc("create_account", {
        p_name: "No auth",
        p_currency: "NGN",
        p_scope: "personal",
      }),
    );
    await bad(
      b.from("categories").insert({
        owner_id: au,
        name: "Forged",
        kind: "expense",
        scope: "personal",
      }),
    );
  });
  await t.test(
    "forged account/category/transfer/refund/reversal rejected",
    async () => {
      await bad(post(b, { p_account: aid, p_category: cb }));
      await bad(post(a, { p_category: cb }));
      await bad(post(a, { p_kind: "transfer", p_destination: bid }));
      await bad(
        post(b, { p_account: bid, p_kind: "refund", p_related: expense }),
      );
      await bad(
        b.rpc("reverse_entry", {
          p_id: expense,
          p_key: randomUUID(),
          p_date: date,
          p_reason: "forged",
        }),
      );
    },
  );
  await t.test("direct ledger mutation denied", async () => {
    await bad(
      a.from("lines").insert({
        owner_id: au,
        entry_id: expense,
        bucket: "expense",
        amount: 999,
      }),
    );
    await bad(
      a.from("entries").update({ description: "Changed" }).eq("id", expense),
    );
    await bad(a.from("entries").delete().eq("id", expense));
  });
  await t.test(
    "concurrent retry creates one entry and payload conflict rejected",
    async () => {
      const k = randomUUID();
      const ids = await Promise.all(
        Array.from({ length: 5 }, () =>
          ok(post(a, { p_key: k, p_amount: "1.00" })),
        ),
      );
      assert.equal(new Set(ids).size, 1);
      await bad(post(a, { p_key: k, p_amount: "2.00" }));
    },
  );
  await t.test(
    "invalid decimals, over-refunds, self/FX transfers and duplicate openings rejected",
    async () => {
      for (const s of ["NaN", "Infinity", "0.001", "-1", "0", "1e3"])
        await bad(post(a, { p_amount: s }));
      await bad(
        post(a, { p_kind: "refund", p_related: expense, p_amount: "26.00" }),
      );
      await bad(post(a, { p_kind: "transfer", p_destination: aid }));
      await bad(post(a, { p_kind: "opening" }));
      const usd = await ok(
        a.rpc("create_account", {
          p_name: "USD",
          p_currency: "USD",
          p_scope: "business",
        }),
      );
      await bad(post(a, { p_kind: "transfer", p_destination: usd }));
    },
  );
  await t.test(
    "concurrent over-refunds cannot exceed original expense",
    async () => {
      const e = await ok(post(a, { p_amount: "10.00" }));
      const results = await Promise.all([
        post(a, { p_kind: "refund", p_related: e, p_amount: "7.00" }),
        post(a, { p_kind: "refund", p_related: e, p_amount: "7.00" }),
      ]);
      assert.equal(results.filter((r) => !r.error).length, 1);
    },
  );
  await t.test(
    "correction preserves original and reverses exactly once",
    async () => {
      const id = await ok(post(a, { p_amount: "3.25" }));
      const key = randomUUID();
      const args = {
        p_id: id,
        p_key: key,
        p_date: date,
        p_reason: "Wrong amount",
      };
      const reversal = await ok(a.rpc("reverse_entry", args));
      assert.equal(await ok(a.rpc("reverse_entry", args)), reversal);
      await bad(a.rpc("reverse_entry", { ...args, p_key: randomUUID() }));
      const original = await ok(
        a.from("journal").select("amount,bucket").eq("id", id),
      );
      const rev = await ok(
        a.from("journal").select("amount,bucket").eq("id", reversal),
      );
      assert.equal(original.length, 2);
      assert.equal(rev.length, 2);
      assert.equal(
        original.find((x) => x.bucket === "expense").amount,
        "3.25000000",
      );
      assert.equal(
        rev.find((x) => x.bucket === "expense").amount,
        "-3.25000000",
      );
    },
  );
  await t.test("budgets cannot refer to another owner category", async () => {
    await bad(
      a.from("budgets").insert({
        owner_id: au,
        category_id: cb,
        month: "2026-10-01",
        currency: "NGN",
        amount: "100",
      }),
    );
  });
  await t.test(
    "preferences and category classification stay valid",
    async () => {
      await bad(
        a.from("profiles").upsert({ id: au, timezone: "Invalid/Timezone" }),
      );
      await bad(a.from("categories").update({ kind: "income" }).eq("id", ca));
      await ok(
        a.from("categories").update({ name: "Food renamed" }).eq("id", ca),
      );
      await bad(
        a.from("budgets").insert({
          owner_id: au,
          category_id: income,
          month: "2026-10-01",
          currency: "NGN",
          amount: "100",
        }),
      );
    },
  );
  await t.test(
    "opening balances preserve selected effective date",
    async () => {
      const id = await ok(
        a.rpc("create_account", {
          p_name: "Historical opening",
          p_currency: "NGN",
          p_scope: "personal",
          p_opening: "2.50",
          p_date: "2024-02-29",
        }),
      );
      const row = await ok(
        a
          .from("journal")
          .select("effective_date")
          .eq("account_id", id)
          .single(),
      );
      assert.equal(row.effective_date, "2024-02-29");
    },
  );
  await t.test("database enforces per-owner posting rate limit", async () => {
    const c = client();
    await ok(
      c.auth.signUp({
        email: `limit-${randomUUID()}@example.test`,
        password: randomUUID() + "Ab9!",
      }),
    );
    const uid = (await c.auth.getUser()).data.user.id;
    const id = await ok(
      c.rpc("create_account", {
        p_name: "Limit fixture",
        p_currency: "NGN",
        p_scope: "personal",
      }),
    );
    const cat = (
      await ok(
        c
          .from("categories")
          .insert({
            owner_id: uid,
            name: "Limit expense",
            kind: "expense",
            scope: "personal",
          })
          .select()
          .single(),
      )
    ).id;
    for (let i = 0; i < 60; i++)
      await ok(post(c, { p_account: id, p_category: cat, p_amount: "1.00" }));
    const error = await bad(
      post(c, { p_account: id, p_category: cat, p_amount: "1.00" }),
    );
    assert.match(error.message, /Posting limit/);
  });
});
