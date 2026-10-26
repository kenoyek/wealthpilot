import Decimal from "decimal.js";
import type { Line } from "./data";
export function totals(rows: Line[], currency: string) {
  const relevant = rows.filter((r) => r.currency === currency);
  const income = relevant
    .filter((r) => r.bucket === "income")
    .reduce((n, r) => n.minus(r.amount), new Decimal(0));
  const expenses = relevant
    .filter((r) => r.bucket === "expense")
    .reduce((n, r) => n.plus(r.amount), new Decimal(0));
  return {
    income: income.toString(),
    expenses: expenses.toString(),
    net: income.minus(expenses).toString(),
  };
}
export function categorySpending(
  rows: Line[],
  category: string,
  currency: string,
) {
  return rows
    .filter(
      (r) =>
        r.bucket === "expense" &&
        r.category_id === category &&
        r.currency === currency,
    )
    .reduce((n, r) => n.plus(r.amount), new Decimal(0));
}

export function cashMovement(rows: Line[], currency: string) {
  return rows
    .filter(
      (r) =>
        r.currency === currency &&
        r.bucket === "asset" &&
        r.kind !== "opening" &&
        !(r.kind === "reversal" && r.related_kind === "opening"),
    )
    .reduce((n, r) => n.plus(r.amount), new Decimal(0))
    .toString();
}
