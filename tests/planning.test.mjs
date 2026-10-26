import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(
  url || "",
  /^http:\/\/(127\.0\.0\.1|localhost):54321$/,
  "Use disposable local Supabase only",
);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
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
  assert.ok(r.error, "Operation should be rejected");
  return r.error;
};
const today = new Date().toISOString().slice(0, 10);
const keyArgs = () => ({ p_key: randomUUID() });
test("phase 2 backed planning and authorization", async (t) => {
  const a = fresh(),
    b = fresh();
  for (const c of [a, b])
    await ok(
      c.auth.signUp({
        email: `planning-${randomUUID()}@example.test`,
        password: randomUUID() + "Ab9!",
      }),
    );
  const uid = (await a.auth.getUser()).data.user.id;
  const account = await ok(
    a.rpc("create_account", {
      p_name: "Planning cash",
      p_currency: "NGN",
      p_scope: "personal",
      p_opening: "1000",
    }),
  );
  const other = await ok(
    b.rpc("create_account", {
      p_name: "Other owner",
      p_currency: "NGN",
      p_scope: "personal",
      p_opening: "500",
    }),
  );
  const expense = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: uid,
          name: "Bills",
          kind: "expense",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  const income = (
    await ok(
      a
        .from("categories")
        .insert({
          owner_id: uid,
          name: "Client",
          kind: "income",
          scope: "personal",
        })
        .select()
        .single(),
    )
  ).id;
  const goal = await ok(
    a.rpc("save_goal", {
      ...keyArgs(),
      p_data: {
        name: "Emergency",
        account,
        kind: "emergency",
        target: "1000",
        date: "2028-01-01",
        priority: 1,
        monthly: "20",
        essential: "100",
      },
    }),
  );
  const reserve = await ok(
    a.rpc("save_goal", {
      ...keyArgs(),
      p_data: {
        name: "Bills reserve",
        account,
        kind: "obligation",
        target: "500",
        date: "2028-01-01",
        priority: 1,
      },
    }),
  );
  const fund = (id, value, release = false, k = randomUUID()) =>
    a.rpc("fund_goal", {
      p_key: k,
      p_goal: id,
      p_amount: value,
      p_release: release,
    });
  const commitment = (
    name,
    amount = "100",
    goalId = reserve,
    date = today,
    cadence = "once",
  ) =>
    a.rpc("save_commitment", {
      ...keyArgs(),
      p_data: {
        name,
        account,
        category: expense,
        kind: "bill",
        amount,
        cadence,
        date,
        reserve: goalId,
        essential: true,
      },
    });
  let bill, debt, payment, receipt, batch;
  await t.test("earmarks do not change cash, income or net worth", async () => {
    const k = randomUUID();
    const first = await ok(fund(goal, "100", false, k));
    assert.equal(await ok(fund(goal, "100", false, k)), first);
    assert.equal(
      (await ok(a.from("goal_values").select("*").eq("id", goal).single()))
        .funded,
      "100.00000000",
    );
    assert.equal(
      (
        await ok(
          a
            .from("account_balances")
            .select("balance")
            .eq("id", account)
            .single(),
        )
      ).balance,
      "1000.00000000",
    );
    await bad(fund(goal, "2000"));
    await bad(fund(goal, "101", true));
    await bad(fund(goal, "0.001"));
  });
  await t.test(
    "shared bill reserves are counted once, not once per linked bill",
    async () => {
      bill = await ok(commitment("Internet"));
      await ok(commitment("Electricity"));
      await ok(fund(reserve, "150"));
      const p = await ok(a.rpc("planning_position", { p_account: account }));
      assert.equal(p.reserved, "250.00000000");
      assert.equal(p.uncovered, "50.00000000");
      assert.equal(p.safe, "700.00000000");
    },
  );
  await t.test(
    "RLS and all planning entry points reject cross-user identifiers",
    async () => {
      for (const table of [
        "goal_values",
        "commitment_values",
        "goal_history",
        "planning_audit",
        "received_income",
      ])
        assert.equal(
          (await ok(b.from(table).select("*").eq("owner_id", uid))).length,
          0,
        );
      await bad(b.rpc("planning_position", { p_account: account }));
      await bad(
        b.rpc("fund_goal", { ...keyArgs(), p_goal: goal, p_amount: "1" }),
      );
      await bad(
        b.rpc("save_goal", {
          ...keyArgs(),
          p_id: goal,
          p_data: {
            name: "forged",
            account: other,
            kind: "goal",
            target: "100",
            date: "2028-01-01",
            priority: 1,
          },
        }),
      );
      await bad(
        b.rpc("change_commitment", { ...keyArgs(), p_id: bill, p_amount: "1" }),
      );
      await bad(
        a.from("goal_events").insert({
          owner_id: uid,
          goal_id: goal,
          amount: 999,
          effective_date: today,
          reason: "forged",
        }),
      );
      await bad(
        fresh().rpc("fund_goal", { ...keyArgs(), p_goal: goal, p_amount: "1" }),
      );
    },
  );
  await t.test(
    "recorded bills consume reserves and cannot be paid twice concurrently",
    async () => {
      const results = await Promise.all(
        Array.from({ length: 2 }, () =>
          a.rpc("pay_commitment", {
            ...keyArgs(),
            p_id: bill,
            p_due: today,
            p_date: today,
            p_quote: "100",
          }),
        ),
      );
      assert.equal(results.filter((r) => !r.error).length, 1);
      payment = results.find((r) => !r.error).data;
      assert.equal(
        (
          await ok(
            a.from("goal_values").select("funded").eq("id", reserve).single(),
          )
        ).funded,
        "50.00000000",
      );
      const p = await ok(a.rpc("planning_position", { p_account: account }));
      assert.equal(p.cash, "900.00000000");
      assert.equal(p.safe, "700.00000000");
      const row = await ok(
        a
          .from("commitment_payments")
          .select("entry_id")
          .eq("id", payment)
          .single(),
      );
      await bad(
        a.rpc("reverse_entry", {
          p_id: row.entry_id,
          ...keyArgs(),
          p_date: today,
          p_reason: "Bypass",
        }),
      );
    },
  );
  await t.test(
    "undo restores bill schedule and consumed earmarks idempotently",
    async () => {
      const args = {
        ...keyArgs(),
        p_id: payment,
        p_kind: "commitment",
        p_date: today,
        p_reason: "Wrong recorded payment",
      };
      const id = await ok(a.rpc("undo_planning_payment", args));
      assert.equal(await ok(a.rpc("undo_planning_payment", args)), id);
      assert.equal(
        (
          await ok(
            a
              .from("commitment_values")
              .select("next_due")
              .eq("id", bill)
              .single(),
          )
        ).next_due,
        today,
      );
      assert.equal(
        (
          await ok(
            a.from("goal_values").select("funded").eq("id", reserve).single(),
          )
        ).funded,
        "150.00000000",
      );
    },
  );
  await t.test(
    "a stale price quote is rejected and monthly anchors survive February",
    async () => {
      const id = await ok(
        commitment("Month end", "10", null, "2027-01-31", "monthly"),
      );
      await ok(
        a.rpc("change_commitment", { ...keyArgs(), p_id: id, p_amount: "12" }),
      );
      await bad(
        a.rpc("pay_commitment", {
          ...keyArgs(),
          p_id: id,
          p_due: "2027-01-31",
          p_date: today,
          p_quote: "10",
        }),
      );
      await ok(
        a.rpc("pay_commitment", {
          ...keyArgs(),
          p_id: id,
          p_due: "2027-01-31",
          p_date: today,
          p_quote: "12",
        }),
      );
      assert.equal(
        (
          await ok(
            a
              .from("commitment_values")
              .select("next_due")
              .eq("id", id)
              .single(),
          )
        ).next_due,
        "2027-02-28",
      );
      await ok(
        a.rpc("pay_commitment", {
          ...keyArgs(),
          p_id: id,
          p_due: "2027-02-28",
          p_date: today,
          p_quote: "12",
        }),
      );
      assert.equal(
        (
          await ok(
            a
              .from("commitment_values")
              .select("next_due")
              .eq("id", id)
              .single(),
          )
        ).next_due,
        "2027-03-31",
      );
    },
  );
  await t.test(
    "allocations are capped by actual receipt and live obligation-adjusted cash",
    async () => {
      receipt = await ok(
        a.rpc("post_entry", {
          ...keyArgs(),
          p_kind: "income",
          p_account: account,
          p_amount: "100",
          p_date: today,
          p_description: "Client paid",
          p_category: income,
        }),
      );
      await bad(
        a.rpc("allocate_income", {
          ...keyArgs(),
          p_entry: receipt,
          p_plan: [{ goal, amount: "101" }],
        }),
      );
      const k = randomUUID();
      const args = {
        p_key: k,
        p_entry: receipt,
        p_plan: [
          { goal, amount: "60" },
          { goal: reserve, amount: "40" },
        ],
      };
      batch = await ok(a.rpc("allocate_income", args));
      assert.equal(await ok(a.rpc("allocate_income", args)), batch);
      await bad(
        a.rpc("allocate_income", {
          ...keyArgs(),
          p_entry: receipt,
          p_plan: [{ goal, amount: "1" }],
        }),
      );
      await bad(
        b.rpc("allocate_income", {
          ...keyArgs(),
          p_entry: receipt,
          p_plan: [{ goal, amount: "1" }],
        }),
      );
      assert.equal(
        (
          await ok(
            a
              .from("received_income")
              .select("unallocated")
              .eq("id", receipt)
              .single(),
          )
        ).unallocated,
        "0.00000000",
      );
    },
  );
  await t.test(
    "allocation undo releases reserves without changing the ledger",
    async () => {
      await ok(a.rpc("undo_allocation", { ...keyArgs(), p_batch: batch }));
      assert.equal(
        (
          await ok(
            a
              .from("received_income")
              .select("unallocated")
              .eq("id", receipt)
              .single(),
          )
        ).unallocated,
        "100.00000000",
      );
    },
  );
  await t.test(
    "debt payments split principal and interest, partial minimums preserve due date",
    async () => {
      debt = await ok(
        a.rpc("create_debt", {
          ...keyArgs(),
          p_data: {
            name: "Loan",
            account,
            principal: "200",
            minimum: "50",
            apr: "12",
            date: today,
            reserve: reserve,
          },
        }),
      );
      const p = await ok(
        a.rpc("pay_debt", {
          ...keyArgs(),
          p_id: debt,
          p_principal: "20",
          p_interest: "5",
          p_category: expense,
          p_date: today,
        }),
      );
      const entry = (
        await ok(
          a.from("debt_payments").select("entry_id").eq("id", p).single(),
        )
      ).entry_id;
      const lines = await ok(
        a.from("journal").select("bucket,amount").eq("id", entry),
      );
      assert.equal(
        lines.find((l) => l.bucket === "expense").amount,
        "5.00000000",
      );
      assert.equal(
        lines.find((l) => l.bucket === "liability").amount,
        "20.00000000",
      );
      assert.equal(
        lines.find((l) => l.bucket === "asset").amount,
        "-25.00000000",
      );
      const d = await ok(
        a.from("debt_values").select("*").eq("id", debt).single(),
      );
      assert.equal(d.remaining, "180.00000000");
      assert.equal(d.next_due, today);
      await bad(
        b.rpc("pay_debt", {
          ...keyArgs(),
          p_id: debt,
          p_principal: "1",
          p_interest: "0",
          p_category: null,
          p_date: today,
        }),
      );
      await bad(
        a.rpc("pay_debt", {
          ...keyArgs(),
          p_id: debt,
          p_principal: "181",
          p_interest: "0",
          p_category: null,
          p_date: today,
        }),
      );
      const newer = await ok(
        a.rpc("pay_debt", {
          ...keyArgs(),
          p_id: debt,
          p_principal: "25",
          p_interest: "0",
          p_category: null,
          p_date: today,
        }),
      );
      await bad(
        a.rpc("undo_planning_payment", {
          ...keyArgs(),
          p_id: p,
          p_kind: "debt",
          p_date: today,
          p_reason: "Older payment",
        }),
      );
      await ok(
        a.rpc("undo_planning_payment", {
          ...keyArgs(),
          p_id: newer,
          p_kind: "debt",
          p_date: today,
          p_reason: "Undo newest",
        }),
      );
      await ok(
        a.rpc("undo_planning_payment", {
          ...keyArgs(),
          p_id: p,
          p_kind: "debt",
          p_date: today,
          p_reason: "Undo partial",
        }),
      );
      assert.equal(
        (
          await ok(
            a.from("debt_values").select("remaining").eq("id", debt).single(),
          )
        ).remaining,
        "200.00000000",
      );
    },
  );
  await t.test(
    "cash backing survives concurrent funding and Phase 1 spending",
    async () => {
      const cash = await ok(
        a.rpc("create_account", {
          p_name: "Limited cash",
          p_currency: "NGN",
          p_scope: "personal",
          p_opening: "50",
        }),
      );
      const g = await ok(
        a.rpc("save_goal", {
          ...keyArgs(),
          p_data: {
            name: "Limited goal",
            account: cash,
            kind: "goal",
            target: "100",
            date: "2028-01-01",
            priority: 1,
          },
        }),
      );
      const results = await Promise.all([fund(g, "40"), fund(g, "40")]);
      assert.equal(results.filter((r) => !r.error).length, 1);
      await bad(
        a.rpc("post_entry", {
          ...keyArgs(),
          p_kind: "expense",
          p_account: cash,
          p_amount: "20",
          p_date: today,
          p_category: expense,
        }),
      );
      assert.equal(
        (
          await ok(
            a
              .from("account_balances")
              .select("balance")
              .eq("id", cash)
              .single(),
          )
        ).balance,
        "50.00000000",
      );
      await bad(a.rpc("archive_account", { p_id: cash }));
      await ok(fund(g, "40", true));
      await ok(a.rpc("archive_account", { p_id: cash }));
    },
  );
  await t.test(
    "stale cash capacity prevents two simultaneous income allocations",
    async () => {
      const aid = await ok(
        a.rpc("create_account", {
          p_name: "Allocation capacity",
          p_currency: "NGN",
          p_scope: "personal",
        }),
      );
      const rid = await ok(
        a.rpc("post_entry", {
          ...keyArgs(),
          p_kind: "income",
          p_account: aid,
          p_amount: "100",
          p_date: today,
          p_category: income,
        }),
      );
      const gid = await ok(
        a.rpc("save_goal", {
          ...keyArgs(),
          p_data: {
            name: "Capacity goal",
            account: aid,
            kind: "goal",
            target: "100",
            date: "2028-01-01",
            priority: 1,
          },
        }),
      );
      await ok(
        a.rpc("save_commitment", {
          ...keyArgs(),
          p_data: {
            name: "Held essentials",
            account: aid,
            category: expense,
            kind: "bill",
            amount: "80",
            cadence: "once",
            date: today,
          },
        }),
      );
      await bad(
        a.rpc("allocate_income", {
          ...keyArgs(),
          p_entry: rid,
          p_plan: [{ goal: gid, amount: "40" }],
        }),
      );
      const results = await Promise.all(
        [1, 2].map(() =>
          a.rpc("allocate_income", {
            ...keyArgs(),
            p_entry: rid,
            p_plan: [{ goal: gid, amount: "20" }],
          }),
        ),
      );
      assert.equal(results.filter((r) => !r.error).length, 1);
      assert.ok(
        new Decimal(
          (await ok(a.rpc("planning_position", { p_account: aid }))).safe,
        ).isZero(),
      );
    },
  );
  await t.test(
    "debt terms are auditable and incorrect openings can be reversed",
    async () => {
      await bad(
        b.rpc("update_debt_plan", {
          ...keyArgs(),
          p_id: debt,
          p_minimum: "25",
          p_apr: "10",
        }),
      );
      await ok(
        a.rpc("update_debt_plan", {
          ...keyArgs(),
          p_id: debt,
          p_minimum: "25",
          p_apr: "10",
        }),
      );
      assert.equal(
        (
          await ok(
            a.from("debt_values").select("minimum").eq("id", debt).single(),
          )
        ).minimum,
        "25.00000000",
      );
      await bad(
        b.rpc("void_debt", {
          ...keyArgs(),
          p_id: debt,
          p_reason: "Forged opening correction",
        }),
      );
      const args = {
        ...keyArgs(),
        p_id: debt,
        p_reason: "Opening amount was wrong",
      };
      const id = await ok(a.rpc("void_debt", args));
      assert.equal(await ok(a.rpc("void_debt", args)), id);
      const d = await ok(
        a
          .from("debt_values")
          .select("voided,remaining")
          .eq("id", debt)
          .single(),
      );
      assert.equal(d.voided, true);
      assert.equal(d.remaining, "0");
      await bad(
        a.rpc("pay_debt", {
          ...keyArgs(),
          p_id: debt,
          p_principal: "1",
          p_interest: "0",
          p_category: null,
          p_date: today,
        }),
      );
    },
  );
  await t.test(
    "budget warning preferences validate without changing balances",
    async () => {
      const data = {
        owner_id: uid,
        category_id: expense,
        month: today.slice(0, 7) + "-01",
        currency: "NGN",
        amount: "100",
        warning_levels: [25, 80],
        alerts_enabled: false,
      };
      const id = (
        await ok(a.from("budgets").insert(data).select("id").single())
      ).id;
      const b = await ok(
        a
          .from("budget_values")
          .select("warning_levels,alerts_enabled")
          .eq("id", id)
          .single(),
      );
      assert.deepEqual(b.warning_levels, [25, 80]);
      assert.equal(b.alerts_enabled, false);
      await bad(
        a
          .from("budgets")
          .update({ warning_levels: [0, 101] })
          .eq("id", id),
      );
      await bad(
        a
          .from("budgets")
          .update({ warning_levels: [null] })
          .eq("id", id),
      );
    },
  );
  await t.test(
    "percentage templates persist with owner/account and total validation",
    async () => {
      const args = {
        ...keyArgs(),
        p_account: account,
        p_name: "Freelance allocation",
        p_weights: [
          { id: goal, weight: "60" },
          { id: reserve, weight: "40" },
        ],
      };
      const id = await ok(a.rpc("save_allocation_template", args));
      assert.equal(await ok(a.rpc("save_allocation_template", args)), id);
      assert.deepEqual(
        (
          await ok(
            a
              .from("allocation_templates")
              .select("weights")
              .eq("id", id)
              .single(),
          )
        ).weights,
        args.p_weights,
      );
      assert.equal(
        (await ok(b.from("allocation_templates").select("*").eq("id", id)))
          .length,
        0,
      );
      await bad(b.rpc("save_allocation_template", { ...args, ...keyArgs() }));
      await bad(
        a.rpc("save_allocation_template", {
          ...args,
          ...keyArgs(),
          p_weights: [{ id: goal, weight: "99" }],
        }),
      );
      await bad(
        a.rpc("save_allocation_template", {
          ...args,
          ...keyArgs(),
          p_weights: [
            { id: goal, weight: "50" },
            { id: goal, weight: "50" },
          ],
        }),
      );
      const updated = await ok(
        a.rpc("save_allocation_template", {
          ...args,
          ...keyArgs(),
          p_weights: [{ id: goal, weight: "100" }],
        }),
      );
      assert.equal(updated, id);
    },
  );
});
