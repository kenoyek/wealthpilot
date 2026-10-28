import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(
  url || "",
  /^http:\/\/(127\.0\.0\.1|localhost):54321$/,
  "Account security fixtures must be local.",
);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.WEALTHPILOT_SECURITY_SECRET;
assert.match(
  secret || "",
  /^[0-9a-f]{64}$/,
  "Initialize the isolated local security key first.",
);
const fresh = () =>
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
  assert.ok(r.error, "Operation must fail");
  return r.error;
};
const capability = (
  owner,
  purpose,
  issued = Math.floor(Date.now() / 1000),
  nonce = randomUUID(),
) => ({
  p_owner: owner,
  p_issued: issued,
  p_nonce: nonce,
  p_signature: createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${purpose}:${owner}:${issued}:${nonce}`)
    .digest("hex"),
});
const today = new Date().toISOString().slice(0, 10);
test("complete exports and signed account deletion preserve other users", async (t) => {
  const a = fresh(),
    b = fresh();
  for (const c of [a, b]) {
    await ok(
      c.auth.signUp({
        email: `security-${randomUUID()}@example.test`,
        password: randomUUID() + "Aa9!",
      }),
    );
    await ok(c.rpc("initialize_workspace"));
  }
  const au = (await a.auth.getUser()).data.user.id,
    bu = (await b.auth.getUser()).data.user.id;
  const aid = await ok(
    a.rpc("create_account", {
      p_name: "Export precision",
      p_currency: "NGN",
      p_scope: "personal",
      p_opening: "99999999999999999999.99",
    }),
  );
  const bid = await ok(
    b.rpc("create_account", {
      p_name: "Untouched",
      p_currency: "USD",
      p_scope: "personal",
      p_opening: "42",
    }),
  );
  const ca = (
    await ok(
      a
        .from("categories")
        .select("id")
        .eq("kind", "expense")
        .eq("scope", "personal")
        .limit(1),
    )
  )[0].id;
  const goal = await ok(
    a.rpc("save_goal", {
      p_key: randomUUID(),
      p_data: {
        name: "Reserve",
        account: aid,
        kind: "goal",
        target: "100",
        date: "2028-01-01",
        priority: 1,
      },
    }),
  );
  await ok(
    a.rpc("fund_goal", { p_key: randomUUID(), p_goal: goal, p_amount: "5" }),
  );
  await ok(
    a.rpc("save_allocation_template", {
      p_key: randomUUID(),
      p_account: aid,
      p_name: "Template",
      p_weights: [{ id: goal, weight: "100" }],
    }),
  );
  await ok(
    a.rpc("save_commitment", {
      p_key: randomUUID(),
      p_data: {
        name: "Bill",
        account: aid,
        category: ca,
        kind: "bill",
        amount: "2",
        cadence: "monthly",
        date: today,
        essential: true,
      },
    }),
  );
  await ok(
    a.rpc("create_debt", {
      p_key: randomUUID(),
      p_data: {
        name: "Debt",
        account: aid,
        principal: "20",
        minimum: "5",
        apr: "0",
        date: today,
      },
    }),
  );
  await ok(
    a.rpc("save_recurring", {
      p_key: randomUUID(),
      p_data: {
        name: "Schedule",
        account: aid,
        category: ca,
        kind: "expense",
        amount: "1",
        cadence: "monthly",
        date: today,
      },
    }),
  );
  for (let batch = 0; batch < 3; batch++)
    await ok(
      a.rpc("import_transactions", {
        p_key: randomUUID(),
        p_account: aid,
        p_preview: false,
        p_rows: Array.from({ length: 200 }, (_, i) => ({
          kind: "expense",
          amount: "0.10",
          date: today,
          description: `Precision row ${batch}-${i}`,
          reference: `batch-${batch}-${i}`,
          category: ca,
        })),
      }),
    );
  let exported;
  await t.test(
    "exports all records past the API row cap and preserves decimal/bigint strings",
    async () => {
      const text = await ok(
        a.rpc("export_my_workspace", capability(au, "export")),
      );
      assert.equal(typeof text, "string");
      exported = JSON.parse(text);
      assert.equal(exported.format, "wealthpilot-workspace");
      assert.equal(exported.record_counts.lines, 1204); // Opening, imports and debt opening.
      assert.equal(exported.record_counts.import_rows, 600);
      assert.ok(exported.tables.lines.length > 1000);
      assert.equal(exported.tables.accounts[0].id, aid);
      assert.ok(
        exported.tables.lines.some(
          (l) => l.amount === "99999999999999999999.99000000",
        ),
      );
      assert.ok(
        exported.tables.audit_logs.every((l) => typeof l.id === "string"),
      );
      assert.ok(
        exported.tables.lines.every((l) => typeof l.amount === "string"),
      );
      assert.ok(
        !Object.keys(exported.tables).some((k) =>
          /config|capabilit|auth\.users/.test(k),
        ),
      );
      assert.ok(!text.includes(secret));
      assert.ok(!text.includes(bid));
    },
  );
  await t.test(
    "bulk export requires a fresh one-time proof, not only a session",
    async () => {
      const args = capability(au, "export");
      await ok(a.rpc("export_my_workspace", args));
      await bad(a.rpc("export_my_workspace", args));
      await bad(
        a.rpc("export_my_workspace", {
          ...capability(au, "export"),
          p_signature: "0".repeat(64),
        }),
      );
      await bad(a.rpc("export_my_workspace", capability(bu, "export")));
    },
  );
  await t.test(
    "exports and closure state are owner scoped, and private tables are not readable",
    async () => {
      const other = JSON.parse(
        await ok(b.rpc("export_my_workspace", capability(bu, "export"))),
      );
      assert.equal(other.tables.accounts.length, 1);
      assert.equal(other.tables.accounts[0].id, bid);
      assert.deepEqual(await ok(a.rpc("account_state")), {
        id: au,
        closed: false,
      });
      assert.equal(other.tables.import_rows.length, 0);
      await bad(a.schema("security_private").from("config").select("*"));
    },
  );
  await t.test(
    "rejects missing, tampered, expired and cross-owner deletion proofs",
    async () => {
      await bad(a.rpc("purge_my_workspace", capability(bu, "purge")));
      await bad(
        a.rpc("purge_my_workspace", {
          ...capability(au, "purge"),
          p_signature: "0".repeat(64),
        }),
      );
      await bad(
        a.rpc(
          "purge_my_workspace",
          capability(au, "purge", Math.floor(Date.now() / 1000) - 121),
        ),
      );
      await bad(a.rpc("purge_my_workspace", capability(au, "finish")));
      assert.equal(
        JSON.parse(
          await ok(a.rpc("export_my_workspace", capability(au, "export"))),
        ).record_counts.import_rows,
        600,
      );
    },
  );
  await t.test(
    "limits security attempts in the database independently of server instances",
    async () => {
      for (let i = 0; i < 5; i++)
        assert.equal(await ok(b.rpc("security_attempt")), true);
      assert.equal(await ok(b.rpc("security_attempt")), false);
    },
  );
  await t.test(
    "bulk undo handles 200 rows without bypassing normal manual limits",
    async () => {
      const batch = exported.tables.import_batches[0].id;
      await ok(
        a.rpc("undo_import", {
          p_key: randomUUID(),
          p_batch: batch,
          p_date: today,
        }),
      );
      const snapshot = JSON.parse(
        await ok(a.rpc("export_my_workspace", capability(au, "export"))),
      );
      assert.equal(snapshot.record_counts.lines, 1604);
      await bad(
        a.rpc("post_entry", {
          p_key: randomUUID(),
          p_kind: "expense",
          p_account: aid,
          p_amount: "1",
          p_date: today,
          p_category: ca,
        }),
      );
    },
  );
  await t.test(
    "deletes only the confirmed fixture's full workspace and local identity",
    async () => {
      await ok(a.rpc("purge_my_workspace", capability(au, "purge")));
      for (const table of Object.keys(exported.tables)) {
        const rows = await a.from(table).select("*");
        assert.equal(rows.error, null, rows.error?.message);
        assert.equal(rows.data.length, 0, table);
      }
      await bad(
        a.rpc("create_account", {
          p_name: "Resurrection",
          p_currency: "NGN",
          p_scope: "personal",
        }),
      );
      await bad(a.rpc("export_my_workspace", capability(au, "export")));
      await ok(b.rpc("finish_account_deletion", capability(au, "finish")));
      const other = JSON.parse(
        await ok(b.rpc("export_my_workspace", capability(bu, "export"))),
      );
      assert.equal(other.tables.accounts[0].id, bid);
      assert.equal(other.tables.lines[0].amount, "42.00000000");
    },
  );
});
