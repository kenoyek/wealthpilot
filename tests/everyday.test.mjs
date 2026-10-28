import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(
  url || "",
  /^http:\/\/(127\.0\.0\.1|localhost):54321$/,
  "Everyday tests require disposable local infrastructure.",
);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const ok = async (p) => {
  const r = await p;
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
const bad = async (p) => {
  const r = await p;
  assert.ok(r.error, "Operation must be rejected");
  return r.error;
};
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
test("everyday financial writes are atomic, repeat-safe and owner isolated", async (t) => {
  const a = client(),
    b = client();
  for (const c of [a, b])
    await ok(
      c.auth.signUp({
        email: `everyday-${randomUUID()}@example.test`,
        password: randomUUID() + "Aa9!",
      }),
    );
  const au = (await a.auth.getUser()).data.user.id,
    bu = (await b.auth.getUser()).data.user.id;
  const aid = await ok(
    a.rpc("create_account", {
      p_name: "Everyday fixture",
      p_currency: "NGN",
      p_scope: "personal",
      p_opening: "1000",
    }),
  );
  const bid = await ok(
    b.rpc("create_account", {
      p_name: "Other fixture",
      p_currency: "NGN",
      p_scope: "personal",
      p_opening: "1000",
    }),
  );
  const ca = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: au,
          name: "Expense",
          kind: "expense",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  const ca2 = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: au,
          name: "Expense 2",
          kind: "expense",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  const ci = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: au,
          name: "Income",
          kind: "income",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  const cb = (
    await ok(
      b
        .from("categories")
        .insert({
          owner_id: bu,
          name: "Expense",
          kind: "expense",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  const balance = async () =>
    new Decimal(
      (
        await ok(
          a.from("account_balances").select("balance").eq("id", aid).single(),
        )
      ).balance,
    ).toString();
  let id;
  const schedule = async () =>
    ok(a.from("recurring_values").select("*").eq("id", id).single());
  const resolve = (s, extra = {}) => ({
    p_key: randomUUID(),
    p_id: id,
    p_revision: s.revision,
    p_due: s.next_due,
    p_date: today,
    p_skip: false,
    ...extra,
  });
  const row = (extra = {}) => ({
    date: today,
    kind: "expense",
    amount: "10.00",
    description: "Imported shop",
    reference: "ref-1",
    category: ca,
    ...extra,
  });
  const imp = (rows, extra = {}) =>
    a.rpc("import_transactions", {
      p_key: randomUUID(),
      p_account: aid,
      p_rows: rows,
      p_preview: false,
      ...extra,
    });
  await t.test(
    "creating a schedule moves no money and rejects foreign categories/accounts",
    async () => {
      const data = {
        name: "Monthly fixture",
        account: aid,
        category: ca,
        kind: "expense",
        amount: "0.10",
        cadence: "monthly",
        date: "2024-01-31",
        description: "Scheduled fixture",
      };
      id = await ok(
        a.rpc("save_recurring", { p_key: randomUUID(), p_data: data }),
      );
      assert.equal(await balance(), "1000");
      await bad(
        a.rpc("save_recurring", {
          p_key: randomUUID(),
          p_data: { ...data, account: bid },
        }),
      );
      await bad(
        a.rpc("save_recurring", {
          p_key: randomUUID(),
          p_data: { ...data, category: cb },
        }),
      );
    },
  );
  await t.test(
    "confirmed occurrence advances leap-month anchor once, including retries",
    async () => {
      const s = await schedule(),
        args = resolve(s);
      const first = await ok(a.rpc("resolve_recurring", args));
      assert.equal(await ok(a.rpc("resolve_recurring", args)), first);
      await bad(a.rpc("resolve_recurring", { ...args, p_key: randomUUID() }));
      await bad(a.rpc("resolve_recurring", { ...args, p_skip: true }));
      assert.equal((await schedule()).next_due, "2024-02-29");
      assert.equal(await balance(), "999.9");
    },
  );
  await t.test(
    "skip, pause, resume and revision-checked edits do not post money",
    async () => {
      await ok(
        a.rpc("resolve_recurring", resolve(await schedule(), { p_skip: true })),
      );
      assert.equal((await schedule()).next_due, "2024-03-31");
      let s = await schedule();
      await ok(
        a.rpc("set_recurring_active", {
          p_key: randomUUID(),
          p_id: id,
          p_revision: s.revision,
          p_active: false,
        }),
      );
      await bad(a.rpc("resolve_recurring", resolve(await schedule())));
      s = await schedule();
      await ok(
        a.rpc("set_recurring_active", {
          p_key: randomUUID(),
          p_id: id,
          p_revision: s.revision,
          p_active: true,
        }),
      );
      s = await schedule();
      const args = {
        p_key: randomUUID(),
        p_id: id,
        p_revision: s.revision,
        p_data: {
          name: "Edited fixture",
          account: aid,
          category: ca,
          kind: "expense",
          amount: "25",
          cadence: "monthly",
          date: s.next_due,
          description: "Edited",
        },
      };
      await ok(a.rpc("save_recurring", args));
      await bad(a.rpc("save_recurring", { ...args, p_key: randomUUID() }));
      await bad(
        a.rpc("save_recurring", {
          ...args,
          p_key: randomUUID(),
          p_revision: (await schedule()).revision,
          p_data: { ...args.p_data, date: "2024-01-31" },
        }),
      );
      assert.equal(await balance(), "999.9");
    },
  );
  await t.test("concurrent confirmations post exactly once", async () => {
    const s = await schedule();
    const results = await Promise.all([
      a.rpc("resolve_recurring", resolve(s)),
      a.rpc("resolve_recurring", resolve(s)),
    ]);
    assert.equal(results.filter((r) => !r.error).length, 1);
    assert.equal(await balance(), "974.9");
  });
  const rows = [
    row(),
    row({
      kind: "income",
      category: ci,
      amount: "30.20",
      reference: "ref-2",
      description: "Imported pay",
    }),
    row(),
  ];
  let batch;
  await t.test(
    "preview is read only and commit handles duplicates atomically",
    async () => {
      const args = {
        p_key: randomUUID(),
        p_account: aid,
        p_rows: rows,
        p_preview: true,
      };
      const preview = await ok(a.rpc("import_transactions", args));
      assert.equal(preview.imported, 2);
      assert.equal(preview.skipped, 1);
      assert.equal(await balance(), "974.9");
      assert.equal((await ok(a.from("import_batches").select("id"))).length, 0);
      const committed = await ok(
        a.rpc("import_transactions", { ...args, p_preview: false }),
      );
      assert.equal(committed.imported, 2);
      assert.equal(await balance(), "995.1");
      assert.equal(
        (await ok(a.rpc("import_transactions", { ...args, p_preview: false })))
          .replayed,
        true,
      );
      await bad(
        a.rpc("import_transactions", {
          ...args,
          p_preview: false,
          p_rows: [row()],
        }),
      );
      batch = (await ok(a.from("import_batches").select("*").single())).id;
    },
  );
  await t.test(
    "reuploads and category changes skip duplicates, conflicting references reject",
    async () => {
      const result = await ok(
        imp([row({ amount: "10", category: ca2 }), ...rows.slice(1)]),
      );
      assert.equal(result.imported, 0);
      assert.equal(result.skipped, 3);
      await bad(imp([row({ amount: "11" })]));
      assert.equal(await balance(), "995.1");
    },
  );
  await t.test(
    "an invalid later row rolls back every new entry and receipt",
    async () => {
      const before = await balance(),
        batches = (await ok(a.from("import_batches").select("id"))).length;
      await bad(
        imp([
          row({ reference: "atomic-valid" }),
          row({ reference: "atomic-bad", category: cb }),
        ]),
      );
      assert.equal(await balance(), before);
      assert.equal(
        (await ok(a.from("import_batches").select("id"))).length,
        batches,
      );
      await bad(imp([row({ reference: "future", date: "9998-01-01" })]));
    },
  );
  await t.test(
    "content dedupe normalizes decimal scale and concurrent imports serialize",
    async () => {
      const rows = [
        row({ reference: "", description: "No reference", amount: "0.10" }),
        row({ reference: "", description: "No reference", amount: "0.1" }),
      ];
      const result = await ok(imp(rows));
      assert.equal(result.imported, 1);
      assert.equal(result.skipped, 1);
      const race = [row({ reference: "race", amount: "1.11" })];
      const results = await Promise.all([imp(race), imp(race)]);
      assert.equal(
        results.reduce((n, r) => n + (r.data?.imported || 0), 0),
        1,
      );
      assert.ok(results.every((r) => !r.error));
      assert.equal(await balance(), "993.89");
    },
  );
  await t.test(
    "undo reverses the batch once and retains duplicate protection",
    async () => {
      const args = { p_key: randomUUID(), p_batch: batch, p_date: today };
      await ok(a.rpc("undo_import", args));
      await ok(a.rpc("undo_import", args));
      await ok(a.rpc("undo_import", { ...args, p_key: randomUUID() }));
      assert.equal(await balance(), "973.69");
      const retry = await ok(imp(rows));
      assert.equal(retry.imported, 0);
      assert.equal(retry.skipped, 3);
      assert.equal(
        (
          await ok(
            a.from("import_batches").select("undone").eq("id", batch).single(),
          )
        ).undone,
        true,
      );
    },
  );
  await t.test(
    "batch undo rejects associated refunds without partially reversing other rows",
    async () => {
      const original = await balance();
      const unique = "undo-refund-" + randomUUID();
      await ok(
        imp([
          row({ reference: unique }),
          row({
            kind: "income",
            category: ci,
            amount: "2",
            reference: unique + "-pay",
          }),
        ]),
      );
      const record = await ok(
        a
          .from("import_rows")
          .select("entry_id,batch_id")
          .eq("account_id", aid)
          .order("entry_id"),
      );
      const batches = await ok(
        a.from("import_batches").select("*").eq("account_id", aid),
      );
      const testBatch = batches.find(
        (candidate) => candidate.imported === 2 && candidate.id !== batch,
      );
      const candidates = record.filter((r) => r.batch_id === testBatch.id);
      const entries = await ok(
        a
          .from("entries")
          .select("id,kind")
          .in(
            "id",
            candidates.map((r) => r.entry_id),
          ),
      );
      const expenseId = entries.find((e) => e.kind === "expense").id;
      const refund = await ok(
        a.rpc("post_entry", {
          p_key: randomUUID(),
          p_kind: "refund",
          p_account: aid,
          p_amount: "3",
          p_date: today,
          p_description: "Refund fixture",
          p_related: expenseId,
        }),
      );
      const before = await balance();
      await bad(
        a.rpc("undo_import", {
          p_key: randomUUID(),
          p_batch: testBatch.id,
          p_date: today,
        }),
      );
      assert.equal(await balance(), before);
      assert.equal(
        (
          await ok(
            a
              .from("import_batches")
              .select("undone")
              .eq("id", testBatch.id)
              .single(),
          )
        ).undone,
        false,
      );
      await ok(
        a.rpc("reverse_entry", {
          p_key: randomUUID(),
          p_id: refund,
          p_date: today,
          p_reason: "Reverse refund fixture",
        }),
      );
      await ok(
        a.rpc("undo_import", {
          p_key: randomUUID(),
          p_batch: testBatch.id,
          p_date: today,
        }),
      );
      assert.equal(await balance(), original);
    },
  );
  await t.test(
    "other users cannot read or mutate schedules, receipts, rows or occurrences",
    async () => {
      for (const table of [
        "recurring_values",
        "recurring_occurrences",
        "import_batches",
        "import_rows",
      ])
        assert.equal((await ok(b.from(table).select("*"))).length, 0);
      await bad(b.rpc("resolve_recurring", resolve(await schedule())));
      await bad(
        b.rpc("undo_import", {
          p_key: randomUUID(),
          p_batch: batch,
          p_date: today,
        }),
      );
      await bad(
        b.rpc("import_transactions", {
          p_key: randomUUID(),
          p_account: aid,
          p_rows: [row()],
          p_preview: true,
        }),
      );
      await bad(
        a.from("recurring_templates").update({ amount: "999" }).eq("id", id),
      );
      await bad(
        a.from("import_batches").insert({ owner_id: au, account_id: aid }),
      );
      const anon = client();
      await bad(
        anon.rpc("import_transactions", {
          p_key: randomUUID(),
          p_account: aid,
          p_rows: [row()],
          p_preview: false,
        }),
      );
    },
  );
});
