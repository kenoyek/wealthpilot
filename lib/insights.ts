import Decimal from "decimal.js";
import { amount, monthBounds, sum } from "./money";
import { totals, categorySpending } from "./summary";
import type { Line } from "./data";
import type { Position } from "./planning-data";

export interface Budget {
  id: string;
  category_id: string;
  currency: string;
  amount: string;
  threshold: number;
  warning_levels: number[];
  alerts_enabled: boolean;
}
export function monthSequence(today: string, count = 7) {
  const date = new Date(monthBounds(today.slice(0, 7)).start + "T12:00:00Z");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() - (count - 1 - i));
    return d.toISOString().slice(0, 7);
  });
}
export function spendingTrends(rows: Line[], currency: string, today: string) {
  const months = monthSequence(today);
  const dated = rows.filter((r) => r.effective_date <= today);
  const series = months.map((month) => ({
    month,
    ...totals(
      dated.filter((r) => r.effective_date.startsWith(month)),
      currency,
    ),
  }));
  const day = Number(today.slice(8));
  const previousMonth = months.at(-2)!;
  const previousEnd = new Date(monthBounds(previousMonth).end + "T12:00:00Z");
  previousEnd.setUTCDate(0);
  const comparableDays = Math.min(day, previousEnd.getUTCDate());
  const comparable = (month: string) =>
    totals(
      dated.filter(
        (r) =>
          r.effective_date.startsWith(month) &&
          Number(r.effective_date.slice(8)) <= comparableDays,
      ),
      currency,
    ).expenses;
  const current = comparable(today.slice(0, 7));
  const previous = comparable(previousMonth);
  const difference = new Decimal(current).minus(previous);
  return {
    series,
    comparableDays,
    current,
    previous,
    difference: difference.toString(),
    percent: new Decimal(previous).gt(0)
      ? difference.div(previous).mul(100).toFixed(1)
      : null,
  };
}
export function budgetSignals(
  budgets: Budget[],
  rows: Line[],
  today: string,
  enabled = true,
) {
  const month = today.slice(0, 7);
  const end = new Date(monthBounds(month).end + "T12:00:00Z");
  end.setUTCDate(0);
  const day = Number(today.slice(8));
  const dated = rows.filter(
    (r) => r.effective_date.startsWith(month) && r.effective_date <= today,
  );
  return budgets.map((b) => {
    const used = categorySpending(dated, b.category_id, b.currency);
    const percent = used.div(b.amount).mul(100);
    const projected = Decimal.max(0, used).div(day).mul(end.getUTCDate());
    const crossed = [b.threshold, ...b.warning_levels].filter((n) =>
      percent.gte(n),
    );
    const status =
      !enabled || !b.alerts_enabled
        ? "muted"
        : used.gt(b.amount)
          ? "over"
          : crossed.length
            ? "milestone"
            : day >= 7 && projected.gt(b.amount)
              ? "pace"
              : "on-track";
    return {
      ...b,
      used: used.toString(),
      remaining: new Decimal(b.amount).minus(used).toString(),
      percent: percent.toFixed(0),
      projected: projected.toString(),
      milestone: crossed.length ? Math.max(...crossed) : null,
      status,
    };
  });
}
export function scenarioAmount(value: string, currency: string) {
  return /^0(?:\.0+)?$/.test(value) ? "0" : amount(value, currency);
}
export function cashForecast(
  positions: Position[],
  income: string,
  spending: string,
) {
  const cash = sum(positions.map((p) => p.cash));
  const due = sum(positions.map((p) => p.due));
  const room = sum(positions.map((p) => p.room));
  const change = new Decimal(income).minus(spending);
  return {
    cash,
    due,
    reserved: sum(positions.map((p) => p.reserved)),
    closing: new Decimal(cash).minus(due).plus(change).toString(),
    unallocated: new Decimal(room).plus(change).toString(),
    shortfalls: positions.filter((p) => new Decimal(p.room).lt(0)).length,
  };
}
