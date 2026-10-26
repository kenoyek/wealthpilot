import { describe, it, expect } from "vitest";
import { amount, sum, formatMoney, monthBounds, csv } from "../lib/money";
import { totals, categorySpending } from "../lib/summary";
import type { Line } from "../lib/data";
const line = (
  bucket: string,
  value: string,
  kind = "expense",
  currency = "NGN",
) => ({ bucket, amount: value, kind, currency, category_id: "food" }) as Line;
describe("financial boundaries", () => {
  it("adds decimals without binary drift", () =>
    expect(sum(["0.10", "0.20"])).toBe("0.3"));
  it("preserves amounts beyond Number safe integer", () =>
    expect(formatMoney("9007199254740993.01", "NGN")).toBe(
      "₦9,007,199,254,740,993.01",
    ));
  it.each([
    "NaN",
    "Infinity",
    "-1",
    "1e3",
    "0",
    "0.001",
    "100000000000000000000",
  ])("rejects invalid NGN input %s", (x) =>
    expect(() => amount(x, "NGN")).toThrow(),
  );
  it("respects zero decimal currencies", () => {
    expect(amount("2", "JPY")).toBe("2");
    expect(() => amount("2.1", "JPY")).toThrow();
  });
  it("uses exclusive calendar boundaries including leap February", () => {
    expect(monthBounds("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-03-01",
    });
    expect(monthBounds("2026-12").end).toBe("2027-01-01");
  });
  it("rejects invalid months", () =>
    expect(() => monthBounds("2026-13")).toThrow());
  it("excludes transfers and opening balances and nets refunds/reversals", () => {
    const rows = [
      line("income", "-100", "income"),
      line("asset", "100", "income"),
      line("expense", "30"),
      line("asset", "-30"),
      line("asset", "-40", "transfer"),
      line("asset", "40", "transfer"),
      line("equity", "-200", "opening"),
      line("expense", "-5", "refund"),
      line("expense", "-10", "reversal"),
      line("expense", "999", "expense", "USD"),
    ];
    expect(totals(rows, "NGN")).toEqual({
      income: "100",
      expenses: "15",
      net: "85",
    });
    expect(categorySpending(rows, "food", "NGN").toString()).toBe("15");
  });
  it("preserves validated numeric export columns", () =>
    expect(csv([["-30.00", "=bad"]], new Set([0]))).toBe('"-30.00","\'=bad"'));
  it("escapes CSV quotes and spreadsheet formulas", () =>
    expect(csv([['=HYPERLINK("bad")', "normal, text", "-12.20"]])).toBe(
      '"\'=HYPERLINK(""bad"")","normal, text","\'-12.20"',
    ));
});
