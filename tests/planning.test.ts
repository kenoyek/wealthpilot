import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { cashMovement, totals } from "../lib/summary";
import type { Line } from "../lib/data";
import {
  nextCycle,
  monthlyEquivalent,
  goalProjection,
  allocationPreview,
  debtScenario,
} from "../lib/planning";
describe("planning arithmetic and calendar rules", () => {
  it("preserves month-end anchors through leap February", () => {
    expect(nextCycle("2024-01-31", "monthly", 31)).toBe("2024-02-29");
    expect(nextCycle("2024-02-29", "monthly", 31)).toBe("2024-03-31");
    expect(nextCycle("2024-02-29", "yearly", 29)).toBe("2025-02-28");
    expect(nextCycle("2027-02-28", "yearly", 29)).toBe("2028-02-29");
    expect(nextCycle("2026-01-31", "quarterly", 31)).toBe("2026-04-30");
  });
  it("handles weekly and one-off commitments", () => {
    expect(nextCycle("2026-12-28", "weekly", 28)).toBe("2027-01-04");
    expect(nextCycle("2026-01-01", "once", 1)).toBeNull();
  });
  it("rejects invalid dates", () =>
    expect(() => nextCycle("2026-02-30", "monthly", 30)).toThrow());
  it("uses planning equivalents without pretending they are billing dates", () => {
    expect(monthlyEquivalent("120", "yearly")).toBe("10");
    expect(monthlyEquivalent("30", "quarterly")).toBe("10");
    expect(monthlyEquivalent("12", "weekly")).toBe("52");
    expect(monthlyEquivalent("12", "once")).toBeNull();
  });
  it("calculates remaining scheduled contribution dates and rounds up", () => {
    expect(
      goalProjection("100", "0", "2026-12-26", "2026-10-26", "NGN", "20"),
    ).toEqual({
      gap: "100",
      months: 3,
      required: "33.34",
      plannedShortfall: "40",
    });
    expect(
      goalProjection("1", "0", "2026-12-26", "2026-10-26", "JPY").required,
    ).toBe("1");
  });
  it("reports past-due goals as shortfalls and funded goals as complete", () => {
    expect(
      goalProjection("100", "30", "2026-01-01", "2026-10-26", "NGN").required,
    ).toBeNull();
    expect(
      goalProjection("100", "100", "2026-01-01", "2026-10-26", "NGN").gap,
    ).toBe("0");
  });
  it("conserves exact cents with deterministic largest remainders", () => {
    const p = allocationPreview(
      "0.05",
      "5",
      [
        { id: "a", weight: "50", remaining: "10" },
        { id: "b", weight: "50", remaining: "10" },
      ],
      "NGN",
    );
    expect(p.plan).toEqual([
      { goal: "a", amount: "0.03" },
      { goal: "b", amount: "0.02" },
    ]);
    expect(p.unassigned).toBe("0.00");
  });
  it("caps by actual available cash, income left and target gap", () => {
    const p = allocationPreview(
      "80",
      "100",
      [{ id: "a", weight: "100", remaining: "30" }],
      "NGN",
    );
    expect(p.capacity).toBe("80.00");
    expect(p.plan[0].amount).toBe("30.00");
    expect(p.unassigned).toBe("50.00");
  });
  it("rejects percentages that do not total 100 and duplicate goals", () => {
    expect(() =>
      allocationPreview(
        "100",
        "100",
        [{ id: "a", weight: "90", remaining: "100" }],
        "NGN",
      ),
    ).toThrow();
    expect(() =>
      allocationPreview(
        "100",
        "100",
        [
          { id: "a", weight: "50", remaining: "100" },
          { id: "a", weight: "50", remaining: "100" },
        ],
        "NGN",
      ),
    ).toThrow();
  });
  it("cannot allocate negative cash or nonexistent income", () => {
    expect(
      allocationPreview(
        "-1",
        "100",
        [{ id: "a", weight: "100", remaining: "100" }],
        "NGN",
      ).plan,
    ).toEqual([]);
    expect(
      allocationPreview(
        "100",
        "0",
        [{ id: "a", weight: "100", remaining: "100" }],
        "NGN",
      ).plan,
    ).toEqual([]);
  });
  it("does not lose cents across many split weights", () => {
    const goals = [
      { id: "a", weight: "33.33", remaining: "100000" },
      { id: "b", weight: "33.33", remaining: "100000" },
      { id: "c", weight: "33.34", remaining: "100000" },
    ];
    for (let cents = 1; cents < 200; cents++) {
      const cash = new Decimal(cents).div(100).toString();
      const p = allocationPreview(cash, cash, goals, "NGN");
      expect(
        p.plan.reduce((n, g) => n.plus(g.amount), new Decimal(0)).eq(cash),
      ).toBe(true);
    }
  });
  it("compares fixed-rate debt strategies and rolls freed minimums forward", () => {
    const debts = [
      { id: "a", remaining: "1000", minimum: "100", apr: "24" },
      { id: "b", remaining: "100", minimum: "20", apr: "0" },
    ];
    const a = debtScenario(debts, "20", "NGN", "avalanche");
    const s = debtScenario(debts, "20", "NGN", "snowball");
    expect(a.complete).toBe(true);
    expect(s.complete).toBe(true);
    expect(new Decimal(a.interest).lte(s.interest)).toBe(true);
  });
  it("identifies a debt that cannot be repaid within the simulation horizon", () =>
    expect(
      debtScenario(
        [{ id: "x", remaining: "1000", minimum: "1", apr: "24" }],
        "0",
        "NGN",
        "avalanche",
      ).complete,
    ).toBe(false));
  it("repays an interest-free balance without inventing interest", () =>
    expect(
      debtScenario(
        [{ id: "x", remaining: "100", minimum: "25", apr: "0" }],
        "0",
        "NGN",
        "snowball",
      ),
    ).toEqual({ months: 4, interest: "0.00", complete: true }));
  it("separates financing principal from operating surplus and excludes opening corrections", () => {
    const rows = [
      { currency: "NGN", bucket: "asset", kind: "opening", amount: "1000" },
      {
        currency: "NGN",
        bucket: "asset",
        kind: "reversal",
        related_kind: "opening",
        amount: "-1000",
      },
      { currency: "NGN", bucket: "asset", kind: "income", amount: "100" },
      { currency: "NGN", bucket: "income", kind: "income", amount: "-100" },
      { currency: "NGN", bucket: "asset", kind: "debt_payment", amount: "-50" },
      {
        currency: "NGN",
        bucket: "liability",
        kind: "debt_payment",
        amount: "40",
      },
      {
        currency: "NGN",
        bucket: "expense",
        kind: "debt_payment",
        amount: "10",
      },
    ] as Line[];
    expect(totals(rows, "NGN").net).toBe("90");
    expect(cashMovement(rows, "NGN")).toBe("50");
  });
});
