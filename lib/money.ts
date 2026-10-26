import Decimal from "decimal.js";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export const currencies = ["NGN", "USD", "CAD", "GBP", "EUR", "JPY"] as const;
export function amount(value: string, currency: string): string {
  if (
    !/^\d+(\.\d+)?$/.test(value) ||
    !currencies.includes(currency as (typeof currencies)[number])
  )
    throw new Error("Enter a valid amount and supported currency.");
  const d = new Decimal(value);
  const places = currency === "JPY" ? 0 : 2;
  if (
    !d.isFinite() ||
    d.lte(0) ||
    d.decimalPlaces() > places ||
    d.gte("100000000000000000000")
  )
    throw new Error(
      `Use a positive amount with at most ${places} decimal places.`,
    );
  return d.toFixed(places);
}
export function sum(values: string[]) {
  return values.reduce((a, b) => a.plus(b), new Decimal(0)).toString();
}
export function formatMoney(value: string, currency: string) {
  const d = new Decimal(value);
  const places = currency === "JPY" ? 0 : 2;
  // Decimal formats the amount without converting the financial value to Number.
  const [whole, fraction] = d.abs().toFixed(places).split(".");
  const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbols: Record<string, string> = {
    NGN: "₦",
    USD: "US$",
    CAD: "CA$",
    GBP: "£",
    EUR: "€",
    JPY: "¥",
  };
  return `${d.isNegative() ? "-" : ""}${symbols[currency] || currency + " "}${digits}${fraction ? "." + fraction : ""}`;
}
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Choose a valid month.");
  const [y, m] = month.split("-").map(Number);
  if (y < 1900 || y > 9998) throw new Error("Month is out of range.");
  return {
    start: `${month}-01`,
    end: `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`,
  };
}
export function csv(rows: string[][], numericColumns = new Set<number>()) {
  return rows
    .map((row) =>
      row
        .map(
          (cell, index) =>
            '"' +
            (/^[\s]*[=+@\-\t\r]/.test(cell) &&
            !(numericColumns.has(index) && /^-?\d+(\.\d+)?$/.test(cell))
              ? "'" + cell
              : cell
            ).replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
}
