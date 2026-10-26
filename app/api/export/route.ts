import { NextRequest } from "next/server";
import { journal, baseData, localMonth } from "@/lib/data";
import { csv, monthBounds } from "@/lib/money";
import { totals, cashMovement } from "@/lib/summary";
export async function GET(request: NextRequest) {
  const { categories, profile } = await baseData();
  const month =
    request.nextUrl.searchParams.get("month") || localMonth(profile?.timezone);
  const raw = request.nextUrl.searchParams.get("scope");
  const scope = raw === "personal" || raw === "business" ? raw : "all";
  try {
    monthBounds(month);
  } catch {
    return new Response("Invalid month", { status: 400 });
  }
  const rows = await journal(month, scope);
  const data = [
    [
      "Record type",
      "Entry ID",
      "Date",
      "Type",
      "Description",
      "Scope",
      "Category",
      "Currency",
      "Account ID / metric",
      "Amount (decimal)",
    ],
  ];
  for (const r of rows)
    data.push([
      "ledger line",
      r.id,
      r.effective_date,
      r.kind,
      r.description,
      r.scope,
      categories.find((c) => c.id === r.category_id)?.name || "",
      r.currency,
      r.account_id || r.bucket,
      r.amount,
    ]);
  for (const c of new Set(rows.map((r) => r.currency))) {
    const t = totals(rows, c);
    for (const [k, v] of Object.entries({
      income: t.income,
      expenses: t.expenses,
      operating_surplus: t.net,
      net_cash_movement: cashMovement(rows, c),
    }))
      data.push(["summary", "", "", "", "", scope, "", c, k, v]);
  }
  return new Response(csv(data, new Set([9])), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wealthpilot-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
