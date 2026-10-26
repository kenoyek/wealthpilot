"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { session } from "@/lib/session";
const v = (f: FormData, k: string) => String(f.get(k) || "");
async function run(
  f: FormData,
  name: string,
  args: Record<string, unknown>,
  path: string,
  notice: string,
) {
  const { client } = await session();
  const { error } = await client.rpc(name, { p_key: v(f, "key"), ...args });
  if (error)
    redirect(
      path +
        (path.includes("?") ? "&" : "?") +
        "error=" +
        encodeURIComponent(error.message.slice(0, 180)),
    );
  revalidatePath("/", "layout");
  redirect(
    path +
      (path.includes("?") ? "&" : "?") +
      "notice=" +
      encodeURIComponent(notice),
  );
}
export async function saveGoal(f: FormData) {
  return run(
    f,
    "save_goal",
    {
      p_id: v(f, "id") || null,
      p_data: {
        name: v(f, "name"),
        account: v(f, "account"),
        kind: v(f, "kind"),
        target: v(f, "target"),
        date: v(f, "date"),
        priority: v(f, "priority"),
        monthly: v(f, "monthly") || "0",
        essential: v(f, "essential") || "0",
      },
    },
    "/planning/goals",
    "Goal saved.",
  );
}
export async function fundGoal(f: FormData) {
  return run(
    f,
    "fund_goal",
    {
      p_goal: v(f, "goal"),
      p_amount: v(f, "amount"),
      p_release: v(f, "mode") === "release",
    },
    "/planning/goals",
    v(f, "mode") === "release"
      ? "Reserve released."
      : "Contribution earmarked. No bank transfer was made.",
  );
}
export async function saveCommitment(f: FormData) {
  const url = v(f, "url");
  if (url) {
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
    } catch {
      redirect(
        "/planning/commitments?error=Use%20an%20HTTPS%20cancellation%20URL.",
      );
    }
  }
  return run(
    f,
    "save_commitment",
    {
      p_data: {
        name: v(f, "name"),
        account: v(f, "account"),
        category: v(f, "category"),
        kind: v(f, "kind"),
        plan: v(f, "plan"),
        amount: v(f, "amount"),
        cadence: v(f, "cadence"),
        date: v(f, "date"),
        reserve: v(f, "reserve") || null,
        essential: v(f, "essential") === "true",
        url,
      },
    },
    "/planning/commitments",
    "Commitment saved.",
  );
}
export async function changeCommitment(f: FormData) {
  return run(
    f,
    "change_commitment",
    {
      p_id: v(f, "id"),
      p_amount: v(f, "amount") || null,
      p_stop: v(f, "mode") === "stop",
    },
    "/planning/commitments",
    v(f, "mode") === "stop"
      ? "Tracking stopped. Cancel with the provider separately."
      : "Future price updated; recorded payments are unchanged.",
  );
}
export async function payCommitment(f: FormData) {
  return run(
    f,
    "pay_commitment",
    {
      p_id: v(f, "id"),
      p_due: v(f, "due"),
      p_date: v(f, "date"),
      p_quote: v(f, "quote"),
    },
    "/planning/commitments",
    "Actual payment recorded and due date advanced.",
  );
}
export async function createDebt(f: FormData) {
  return run(
    f,
    "create_debt",
    {
      p_data: {
        name: v(f, "name"),
        account: v(f, "account"),
        principal: v(f, "principal"),
        minimum: v(f, "minimum"),
        apr: v(f, "apr") || "0",
        date: v(f, "date"),
        reserve: v(f, "reserve") || null,
      },
    },
    "/planning/debts",
    "Debt recorded. Existing debt is not new income.",
  );
}
export async function payDebt(f: FormData) {
  return run(
    f,
    "pay_debt",
    {
      p_id: v(f, "id"),
      p_principal: v(f, "principal") || "0",
      p_interest: v(f, "interest") || "0",
      p_category: v(f, "category") || null,
      p_date: v(f, "date"),
    },
    "/planning/debts",
    "Debt payment recorded. Only interest counts as an expense.",
  );
}
export async function undoPayment(f: FormData) {
  const path =
    v(f, "kind") === "debt" ? "/planning/debts" : "/planning/commitments";
  return run(
    f,
    "undo_planning_payment",
    {
      p_id: v(f, "id"),
      p_kind: v(f, "kind"),
      p_date: v(f, "date"),
      p_reason: v(f, "reason"),
    },
    path,
    "Payment reversed; schedule and any consumed reserve restored.",
  );
}
export async function confirmAllocation(f: FormData) {
  let plan: unknown;
  try {
    plan = JSON.parse(v(f, "plan"));
  } catch {
    redirect("/planning/allocate?error=Invalid%20allocation%20preview.");
  }
  return run(
    f,
    "allocate_income",
    { p_entry: v(f, "entry"), p_plan: plan },
    "/planning/allocate",
    "Allocation confirmed. Funds were earmarked, not moved.",
  );
}
export async function undoAllocation(f: FormData) {
  return run(
    f,
    "undo_allocation",
    { p_batch: v(f, "id") },
    "/planning/allocate",
    "Allocation undone; earmarked funds released.",
  );
}
export async function reminderPreferences(f: FormData) {
  const { client, user } = await session();
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    planning_alerts: v(f, "enabled") === "true",
    reminder_days: Number(v(f, "days")),
  });
  if (error) redirect("/planning?error=Invalid%20reminder%20preferences.");
  revalidatePath("/", "layout");
  redirect("/planning?notice=Reminder%20preferences%20saved.");
}

export async function voidDebt(f: FormData) {
  return run(
    f,
    "void_debt",
    { p_id: v(f, "id"), p_reason: v(f, "reason") },
    "/planning/debts",
    "Debt opening reversed. Create a corrected debt record if needed.",
  );
}
export async function updateDebtPlan(f: FormData) {
  return run(
    f,
    "update_debt_plan",
    { p_id: v(f, "id"), p_minimum: v(f, "minimum"), p_apr: v(f, "apr") },
    "/planning/debts",
    "Repayment planning terms updated. Posted payments are unchanged.",
  );
}

export async function saveAllocationTemplate(f: FormData) {
  let weights: unknown;
  try {
    weights = JSON.parse(v(f, "weights"));
  } catch {
    redirect("/planning/allocate?error=Invalid%20template.");
  }
  return run(
    f,
    "save_allocation_template",
    { p_account: v(f, "account"), p_name: v(f, "name"), p_weights: weights },
    "/planning/allocate?entry=" + encodeURIComponent(v(f, "entry")),
    "Percentage template saved.",
  );
}
