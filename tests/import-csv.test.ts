import { describe, it, expect } from "vitest";
import { csvCells, parseImportCsv, maxCsvBytes } from "../lib/import-csv";
const header = "date,type,amount,description,reference\n";
const today = "2026-10-28";
const parse = (s: string, c = "NGN") => parseImportCsv(s, c, today);
describe("CSV financial validation", () => {
  it("handles BOM, reordered case-insensitive headers, CRLF and blank lines", () => {
    expect(
      parse(
        "\uFEFFTYPE,date,description,amount\r\n\r\nIncome,2026-10-28,Pay,100\r\n",
      ),
    ).toEqual([
      {
        date: today,
        kind: "income",
        amount: "100.00",
        description: "Pay",
        reference: "",
      },
    ]);
  });
  it("supports quoted commas, escaped quotes and multiline descriptions", () => {
    const rows = parse(
      header + '2026-10-20,expense,0.10,"Shop, ""North""\r\nweekly",bank-1',
    );
    expect(rows[0]).toMatchObject({
      amount: "0.10",
      description: 'Shop, "North"\nweekly',
      reference: "bank-1",
    });
    expect(csvCells("a,b\rc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
  it("rejects broken quoting and mismatched columns", () => {
    for (const text of [
      header + '2026-10-20,expense,10,"Unclosed,ref',
      header + '2026-10-20,expense,10,"Closed"extra,ref',
      header + '2026-10-20,expense,10,Bad"quote,ref',
      header + "2026-10-20,expense,10,Too few",
    ])
      expect(() => parse(text)).toThrow();
  });
  it("requires unique, explicit known headers and real rows", () => {
    for (const text of [
      "",
      header,
      "date,type,amount,amount\n2026-10-20,income,1,1",
      "date,type,amount,description,account\n2026-10-20,income,1,x,y",
    ])
      expect(() => parse(text)).toThrow();
  });
  it("validates leap days, ISO dates and actual rather than future dates", () => {
    expect(parse(header + "2024-02-29,expense,10,Leap,")[0].date).toBe(
      "2024-02-29",
    );
    for (const date of [
      "2026-02-29",
      "2026-04-31",
      "28/10/2026",
      "2026-10-29",
      "1899-12-31",
    ])
      expect(() => parse(header + `${date},expense,10,Invalid,`)).toThrow(
        /Row 1/,
      );
  });
  it("rejects unsupported types, signed amounts, formulas, symbols and separators", () => {
    for (const type of ["refund", "transfer", "opening"])
      expect(() => parse(header + `${today},${type},10,x,`)).toThrow();
    for (const value of [
      "-10",
      "0",
      "1e2",
      "NaN",
      "=1+2",
      "₦10",
      "1,000",
      "0.001",
    ])
      expect(() => parse(header + `${today},expense,"${value}",x,`)).toThrow();
  });
  it("preserves exact large decimals and enforces currency precision", () => {
    expect(
      parse(header + `${today},income,99999999999999999999.99,x,`)[0].amount,
    ).toBe("99999999999999999999.99");
    expect(parse(header + `${today},income,10,x,`, "JPY")[0].amount).toBe("10");
    expect(() => parse(header + `${today},income,10.1,x,`, "JPY")).toThrow();
  });
  it("bounds UTF-8 bytes, rows, references and descriptions", () => {
    expect(() => parse("é".repeat(maxCsvBytes))).toThrow(/256/);
    expect(() =>
      parse(
        header +
          Array.from({ length: 201 }, () => `${today},income,10,x,`).join("\n"),
      ),
    ).toThrow(/200/);
    expect(() =>
      parse(header + `${today},income,10,${"x".repeat(501)},`),
    ).toThrow();
    expect(() =>
      parse(header + `${today},income,10,x,${"x".repeat(161)}`),
    ).toThrow();
    expect(() => parse(header + `${today},income,10,\0,`)).toThrow();
  });
  it("retains description text without evaluating spreadsheet formulas", () => {
    expect(
      parse(header + `${today},expense,10,=SUM(A1:A2),`)[0].description,
    ).toBe("=SUM(A1:A2)");
  });
});
