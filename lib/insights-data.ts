import { cache } from "react";
import { baseData } from "./data";
import type { Budget } from "./insights";

export const monthlyBudgets = cache(async (month: string) => {
  const { client } = await baseData();
  const { data, error } = await client
    .from("budget_values")
    .select("*")
    .eq("month", month + "-01");
  if (error) throw new Error("Unable to load budgets. Please retry.");
  return (data || []) as Budget[];
});
