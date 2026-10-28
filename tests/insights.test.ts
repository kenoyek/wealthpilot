import { describe, expect, it } from "vitest";
import {
  budgetSignals,
  cashForecast,
  monthSequence,
  scenarioAmount,
  spendingTrends,
  type Budget,
} from "../lib/insights";
import type { Line } from "../lib/data";
import type { Position } from "../lib/planning-data";

function line(date: string, value: string, extra: Partial<Line> = {}): Line {
  return {
    id: "entry",
    line_id: "line",
    kind: "expense",
    effective_date: date,
    description: "",
    scope: "personal",
    currency: "NGN",
    category_id: "food",
    related_entry: null,
    account_id: null,
    bucket: "expense",
    amount: value,
    created_at: date,
    ...extra,
  };
}
const budget: Budget = {
  id: "b",
  category_id: "food",
  currency: "NGN",
  amount: "100",
  threshold: 90,
  warning_levels: [50, 75, 90, 100],
  alerts_enabled: true,
};
const position: Position = {
  cash: "1000",
  reserved: "300",
  due: "200",
  uncovered: "50",
  room: "650",
  safe: "650",
  currency: "NGN",
  through: "2026-11-27",
};

describe("recorded financial insights", () => {
  it("rolls month windows across the year boundary", () => {
    expect(monthSequence("2026-02-28")).toEqual([
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
  it("compares equal elapsed days when February is shorter", () => {
    const rows = [
      line("2024-02-29", "10"),
      line("2024-03-29", "15"),
      line("2024-03-30", "50"),
      line("2024-03-31", "100"),
    ];
    const t = spendingTrends(rows, "NGN", "2024-03-30");
    expect(t.comparableDays).toBe(29);
    expect(t.current).toBe("15");
    expect(t.previous).toBe("10");
    expect(t.percent).toBe("50.0");
    expect(t.series.at(-1)?.expenses).toBe("65");
  });
  it("keeps currencies separate and handles refunds, reversals and transfers", () => {
    const rows = [
      line("2026-10-01", "100"),
      line("2026-10-02", "-25", { kind: "refund" }),
      line("2026-10-03", "-5", { kind: "reversal" }),
      line("2026-10-04", "500", { currency: "USD" }),
      line("2026-10-04", "800", { bucket: "asset", kind: "transfer" }),
      line("2026-10-04", "-200", { bucket: "income", kind: "income" }),
    ];
    const t = spendingTrends(rows, "NGN", "2026-10-28");
    expect(t.series.at(-1)).toMatchObject({
      income: "200",
      expenses: "70",
      net: "130",
    });
    expect(t.percent).toBeNull();
  });
  it("does not invent a percentage for a zero or net-negative baseline", () => {
    expect(
      spendingTrends(
        [line("2026-09-01", "-20"), line("2026-10-01", "10")],
        "NGN",
        "2026-10-28",
      ).percent,
    ).toBeNull();
  });
  it("reports over-budget spending with exact decimal amounts", () => {
    const [s] = budgetSignals(
      [budget],
      [line("2026-10-01", "100.10")],
      "2026-10-28",
    );
    expect(s.status).toBe("over");
    expect(s.remaining).toBe("-0.1");
  });
  it("prioritizes crossed custom milestones and respects both alert switches", () => {
    const rows = [line("2026-10-01", "60")];
    expect(
      budgetSignals(
        [{ ...budget, warning_levels: [55] }],
        rows,
        "2026-10-28",
      )[0],
    ).toMatchObject({ status: "milestone", milestone: 55 });
    expect(budgetSignals([budget], rows, "2026-10-28", false)[0].status).toBe(
      "muted",
    );
    expect(
      budgetSignals(
        [{ ...budget, alerts_enabled: false }],
        rows,
        "2026-10-28",
      )[0].status,
    ).toBe("muted");
  });
  it("only warns about pace after seven days and excludes future activity", () => {
    const rows = [line("2026-10-01", "30"), line("2026-10-29", "999")];
    expect(budgetSignals([budget], rows, "2026-10-06")[0].status).toBe(
      "on-track",
    );
    expect(budgetSignals([budget], rows, "2026-10-07")[0]).toMatchObject({
      status: "pace",
      used: "30",
    });
  });
  it("refunds reduce alerts without negative pace projections", () => {
    const [s] = budgetSignals(
      [budget],
      [line("2026-10-01", "-20")],
      "2026-10-28",
    );
    expect(s).toMatchObject({
      status: "on-track",
      projected: "0",
      remaining: "120",
    });
  });
  it("subtracts obligations once and uses uncovered cash-plan room for reserves", () => {
    expect(cashForecast([position], "100.10", "50.20")).toMatchObject({
      closing: "849.9",
      unallocated: "699.9",
      reserved: "300",
      due: "200",
    });
  });
  it("preserves account shortfalls instead of clamping them away", () => {
    const p = {
      ...position,
      cash: "0",
      reserved: "0",
      due: "100",
      room: "-100",
    };
    expect(cashForecast([position, p], "0", "0")).toMatchObject({
      closing: "700",
      unallocated: "550",
      shortfalls: 1,
    });
    expect(cashForecast([p], "0", "0").unallocated).toBe("-100");
    expect(cashForecast([], "0", "0").closing).toBe("0");
  });
  it("validates scenario currency precision and rejects malformed or unbounded values", () => {
    expect(scenarioAmount("0.00", "NGN")).toBe("0");
    expect(scenarioAmount("0.10", "NGN")).toBe("0.10");
    for (const value of [
      "-1",
      "NaN",
      "1e3",
      "",
      "0.001",
      "100000000000000000000",
    ])
      expect(() => scenarioAmount(value, "NGN")).toThrow();
    expect(() => scenarioAmount("1.1", "JPY")).toThrow();
  });
});
