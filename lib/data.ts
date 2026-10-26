import { session } from "./session";
import { monthBounds } from "./money";
export interface Account {
  id: string;
  name: string;
  currency: string;
  scope: string;
  archived: boolean;
  balance: string;
}
export interface Category {
  id: string;
  name: string;
  kind: string;
  scope: string;
}
export interface Line {
  id: string;
  line_id: string;
  kind: string;
  effective_date: string;
  description: string;
  scope: string;
  currency: string;
  category_id: string | null;
  related_entry: string | null;
  related_kind?: string | null;
  account_id: string | null;
  bucket: string;
  amount: string;
  created_at: string;
}
export async function baseData() {
  const { client, user } = await session();
  const [a, c, p] = await Promise.all([
    client.from("account_balances").select("*").order("created_at"),
    client.from("categories").select("*").order("name"),
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);
  for (const [table, r] of [
    ["account_balances", a],
    ["categories", c],
    ["profiles", p],
  ] as const)
    if (r.error) {
      console.error("Financial read failed", {
        table,
        code: r.error.code || "FETCH_ERROR",
      });
      throw new Error(
        "Unable to load financial data. Check database migrations and connectivity.",
      );
    }
  return {
    client,
    user,
    accounts: (a.data || []) as Account[],
    categories: (c.data || []) as Category[],
    profile: p.data,
  };
}
export function localMonth(timezone = "Africa/Lagos") {
  return localDate(timezone).slice(0, 7);
}
export function localDate(timezone = "Africa/Lagos") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export async function journal(month: string, scope = "all") {
  const { client } = await session();
  const { start, end } = monthBounds(month);
  const cutoff = new Date().toISOString();
  let query = client
    .from("journal")
    .select("*")
    .lte("created_at", cutoff)
    .gte("effective_date", start)
    .lt("effective_date", end)
    .order("effective_date", { ascending: false })
    .order("line_id");
  if (scope !== "all") query = query.eq("scope", scope);
  // Explicit paging avoids PostgREST's default 1000-row truncation.
  const rows: Line[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new Error("Unable to load ledger.");
    rows.push(...(data as Line[]));
    if (data.length < 1000) break;
    if (rows.length >= 100000)
      throw new Error("This period is too large; choose a smaller period.");
  }
  return rows;
}
