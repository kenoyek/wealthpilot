import { amount } from "./money";
export const maxCsvBytes = 256 * 1024;
export const maxCsvRows = 200;
export interface ImportRow {
  date: string;
  kind: "income" | "expense";
  amount: string;
  description: string;
  reference: string;
}
// Strict RFC-style quoting: commas, embedded newlines and doubled quotes are supported.
export function csvCells(source: string): string[][] {
  if (new TextEncoder().encode(source).length > maxCsvBytes)
    throw new Error("Use a UTF-8 CSV file of at most 256 KiB.");
  const text = source.replace(/^\uFEFF/, "");
  if (text.includes("\0"))
    throw new Error("Use a text CSV file, not a binary file.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const record = () => {
    field();
    if (row.some((v) => v.trim() !== "")) rows.push(row);
    row = [];
    if (rows.length > maxCsvRows + 1)
      throw new Error("Import at most 200 rows at a time.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else if (c === "\r") {
        cell += "\n";
        if (text[i + 1] === "\n") i++;
      } else cell += c;
    } else if (c === ",") field();
    else if (c === "\n" || c === "\r") {
      record();
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else if (closed)
      throw new Error(
        "Unexpected text after a closing quote. Check CSV quoting.",
      );
    else if (c === '"') {
      if (cell.length)
        throw new Error(
          "Quote fields from the start and escape quotes by doubling them.",
        );
      quoted = true;
    } else cell += c;
    if (row.length > 5)
      throw new Error(
        "Use only date, type, amount, description and optional reference columns.",
      );
  }
  if (quoted) throw new Error("A quoted field is not closed.");
  if (cell.length || row.length || closed) record();
  return rows;
}
export function parseImportCsv(
  source: string,
  currency: string,
  today: string,
): ImportRow[] {
  const [rawHeaders, ...records] = csvCells(source);
  if (!rawHeaders) throw new Error("Choose a CSV file or paste its contents.");
  const headers = rawHeaders.map((h) => h.trim().toLowerCase());
  const required = ["date", "type", "amount", "description"];
  if (
    new Set(headers).size !== headers.length ||
    required.some((h) => !headers.includes(h)) ||
    headers.some((h) => ![...required, "reference"].includes(h))
  )
    throw new Error(
      "Use unique date,type,amount,description headers, with an optional reference column. Download the template to get started.",
    );
  if (!records.length)
    throw new Error("Add at least one transaction below the header.");
  return records.map((cells, index) => {
    try {
      if (cells.length !== headers.length)
        throw new Error("The number of columns does not match the header.");
      const get = (name: string) => (cells[headers.indexOf(name)] || "").trim();
      const date = get("date");
      const d = new Date(date + "T12:00:00Z");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(d.getTime()) ||
        d.toISOString().slice(0, 10) !== date ||
        date < "1900-01-01" ||
        date > today
      )
        throw new Error("Use a real YYYY-MM-DD date through today.");
      const kind = get("type").toLowerCase();
      if (kind !== "income" && kind !== "expense")
        throw new Error(
          "Type must be income or expense. Transfers and refunds need the regular transaction form.",
        );
      const description = get("description"),
        reference = get("reference");
      if (description.length > 500 || reference.length > 160)
        throw new Error(
          "Use descriptions up to 500 characters and references up to 160.",
        );
      return {
        date,
        kind,
        amount: amount(get("amount"), currency),
        description,
        reference,
      };
    } catch (error) {
      throw new Error(
        `Row ${index + 1}: ${error instanceof Error ? error.message : "Invalid transaction."}`,
      );
    }
  });
}
