import Decimal from "decimal.js";
import { amount } from "./money";
export type Cadence = "once" | "weekly" | "monthly" | "quarterly" | "yearly";
function dateParts(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const d = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date)
    throw new Error("Invalid date");
  return d;
}
export function nextCycle(
  date: string,
  cadence: Cadence,
  anchor: number,
): string | null {
  const d = dateParts(date);
  if (cadence === "once") return null;
  if (cadence === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[cadence];
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(anchor, last));
  return d.toISOString().slice(0, 10);
}
export function monthlyEquivalent(value: string, cadence: Cadence) {
  const d = new Decimal(value);
  return cadence === "once"
    ? null
    : cadence === "weekly"
      ? d.mul(52).div(12).toString()
      : cadence === "quarterly"
        ? d.div(3).toString()
        : cadence === "yearly"
          ? d.div(12).toString()
          : d.toString();
}
export function goalProjection(
  target: string,
  funded: string,
  due: string,
  today: string,
  currency: string,
  planned = "0",
) {
  const end = dateParts(due),
    start = dateParts(today);
  const gap = Decimal.max(0, new Decimal(target).minus(funded));
  if (gap.isZero())
    return { gap: "0", months: 0, required: "0", plannedShortfall: "0" };
  if (end < start)
    return {
      gap: gap.toString(),
      months: 0,
      required: null,
      plannedShortfall: gap.toString(),
    };
  // One contribution today and one on each monthly anniversary through the deadline.
  let d = today,
    months = 0;
  const anchor = start.getUTCDate();
  while (d <= due) {
    months++;
    if (months > 120000) throw new Error("Target date too far away");
    d = nextCycle(d, "monthly", anchor)!;
  }
  const scale = currency === "JPY" ? 0 : 2;
  return {
    gap: gap.toString(),
    months,
    required: gap
      .div(months)
      .toDecimalPlaces(scale, Decimal.ROUND_CEIL)
      .toFixed(scale),
    plannedShortfall: Decimal.max(
      0,
      gap.minus(new Decimal(planned).mul(months)),
    ).toString(),
  };
}
export interface AllocationGoal {
  id: string;
  weight: string;
  remaining: string;
}
export function allocationPreview(
  available: string,
  received: string,
  goals: AllocationGoal[],
  currency: string,
) {
  if (
    !goals.length ||
    goals.length > 50 ||
    new Set(goals.map((g) => g.id)).size !== goals.length
  )
    throw new Error("Choose unique goals.");
  const weights = goals.map((g) => new Decimal(g.weight));
  if (
    weights.some(
      (w) => !w.isFinite() || w.lt(0) || w.gt(100) || w.decimalPlaces() > 2,
    ) ||
    !weights.reduce((a, b) => a.plus(b), new Decimal(0)).eq(100)
  )
    throw new Error("Percentages must total exactly 100%.");
  const scale = currency === "JPY" ? 0 : 2,
    unit = new Decimal(10).pow(scale);
  const total = Decimal.max(
    0,
    Decimal.min(available, received),
  ).toDecimalPlaces(scale, Decimal.ROUND_FLOOR);
  const cents = total.mul(unit);
  const split = goals.map((g, i) => {
    const raw = cents.mul(weights[i]).div(100);
    return {
      goal: g.id,
      units: raw.floor(),
      fraction: raw.minus(raw.floor()),
      cap: new Decimal(g.remaining).mul(unit).floor(),
    };
  });
  let leftovers = cents
    .minus(split.reduce((n, g) => n.plus(g.units), new Decimal(0)))
    .toNumber();
  // Only an integer remainder smaller than the number of rows becomes Number.
  for (const g of [...split].sort(
    (a, b) => b.fraction.comparedTo(a.fraction) || a.goal.localeCompare(b.goal),
  )) {
    if (leftovers <= 0) break;
    g.units = g.units.plus(1);
    leftovers--;
  }
  const plan = split
    .map((g) => ({
      goal: g.goal,
      amount: Decimal.max(0, Decimal.min(g.units, g.cap))
        .div(unit)
        .toFixed(scale),
    }))
    .filter((g) => new Decimal(g.amount).gt(0));
  const allocated = plan.reduce((n, g) => n.plus(g.amount), new Decimal(0));
  return {
    capacity: total.toFixed(scale),
    plan,
    unassigned: total.minus(allocated).toFixed(scale),
  };
}
export interface ScenarioDebt {
  id: string;
  remaining: string;
  minimum: string;
  apr: string;
}
export function debtScenario(
  debts: ScenarioDebt[],
  extra: string,
  currency: string,
  method: "avalanche" | "snowball",
) {
  const scale = currency === "JPY" ? 0 : 2;
  const rows = debts
    .map((d) => ({
      ...d,
      balance: new Decimal(d.remaining),
      min: new Decimal(d.minimum),
      rate: new Decimal(d.apr).div(1200),
    }))
    .filter((d) => d.balance.gt(0));
  if (!rows.length) return { months: 0, interest: "0", complete: true };
  const budget = rows.reduce((n, d) => n.plus(d.min), new Decimal(extra));
  let interest = new Decimal(0);
  for (let month = 1; month <= 1200; month++) {
    for (const d of rows) {
      const charge = d.balance
        .mul(d.rate)
        .toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN);
      interest = interest.plus(charge);
      d.balance = d.balance.plus(charge);
    }
    let left = budget;
    for (const d of rows) {
      const pay = Decimal.min(d.balance, d.min, left);
      d.balance = d.balance.minus(pay);
      left = left.minus(pay);
    }
    const ranked = [...rows].sort((a, b) =>
      method === "avalanche"
        ? b.rate.comparedTo(a.rate) ||
          a.balance.comparedTo(b.balance) ||
          a.id.localeCompare(b.id)
        : a.balance.comparedTo(b.balance) ||
          b.rate.comparedTo(a.rate) ||
          a.id.localeCompare(b.id),
    );
    for (const d of ranked) {
      const pay = Decimal.min(d.balance, left);
      d.balance = d.balance.minus(pay);
      left = left.minus(pay);
    }
    if (rows.every((d) => d.balance.eq(0)))
      return {
        months: month,
        interest: interest.toFixed(scale),
        complete: true,
      };
  }
  return { months: 1200, interest: interest.toFixed(scale), complete: false };
}
// Validate externally supplied monthly extra without binary financial arithmetic.
export function scenarioExtra(value: string, currency: string) {
  return value === "0" ? "0" : amount(value, currency);
}
