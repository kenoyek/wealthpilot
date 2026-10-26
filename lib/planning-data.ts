import { cache } from "react";
import { baseData } from "./data";
export interface Goal {
  id: string;
  account_id: string;
  name: string;
  kind: string;
  target: string;
  target_date: string;
  priority: number;
  monthly_plan: string;
  essential_monthly: string;
  funded: string;
  archived: boolean;
  last_contribution: string | null;
}
export interface Commitment {
  id: string;
  account_id: string;
  category_id: string;
  name: string;
  kind: string;
  plan: string;
  amount: string;
  cadence: "once" | "weekly" | "monthly" | "quarterly" | "yearly";
  next_due: string | null;
  anchor_day: number;
  essential: boolean;
  cancel_url: string;
  reserve_goal_id: string | null;
  active: boolean;
}
export interface Debt {
  id: string;
  name: string;
  account_id: string;
  principal: string;
  minimum: string;
  apr: string;
  remaining: string;
  voided: boolean;
  next_due: string;
  anchor_day: number;
  reserve_goal_id: string | null;
}
export interface Position {
  cash: string;
  reserved: string;
  due: string;
  uncovered: string;
  room: string;
  safe: string;
  currency: string;
  through: string;
}
export async function planningData() {
  const base = await baseData();
  const [g, c, d, p] = await Promise.all([
    base.client.from("goal_values").select("*").order("priority"),
    base.client.from("commitment_values").select("*").order("next_due"),
    base.client.from("debt_values").select("*").order("next_due"),
    base.client
      .from("payment_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  for (const r of [g, c, d, p])
    if (r.error)
      throw new Error(
        "Unable to load planning data. Apply pending database migrations.",
      );
  const positions = await accountPositions(base.client);
  return {
    ...base,
    goals: g.data as Goal[],
    commitments: c.data as Commitment[],
    debts: d.data as Debt[],
    payments: p.data || [],
    positions,
  };
}

async function accountPositions(
  client: Awaited<ReturnType<typeof baseData>>["client"],
) {
  const r = await client.rpc("planning_positions");
  if (r.error)
    throw new Error("Unable to calculate your cash plan. Please retry.");
  return (r.data || {}) as Record<string, Position>;
}
export const cashData = cache(async () => {
  const base = await baseData();
  return { ...base, positions: await accountPositions(base.client) };
});
