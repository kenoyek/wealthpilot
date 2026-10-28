"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { session } from "@/lib/session";
import { localDate } from "@/lib/data";
import { parseImportCsv, type ImportRow } from "@/lib/import-csv";
const v = (f: FormData, key: string) => String(f.get(key) || "");
export interface ImportReview {
  imported: number;
  skipped: number;
  rows: (ImportRow & { status: string })[];
}
export async function processImport(
  f: FormData,
): Promise<{ preview?: ImportReview; notice?: string; error?: string }> {
  const { client, user } = await session();
  try {
    const mode = v(f, "mode");
    if (!["preview", "commit"].includes(mode))
      throw new Error("Preview the import before confirming.");
    const [account, profile] = await Promise.all([
      client
        .from("accounts")
        .select("currency")
        .eq("id", v(f, "account"))
        .single(),
      client
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    if (account.error || !account.data || profile.error)
      throw new Error(
        "Account or preferences unavailable. Refresh and try again.",
      );
    const rows = parseImportCsv(
      v(f, "csv"),
      account.data.currency,
      localDate(profile.data?.timezone),
    );
    const payload = rows.map((r) => ({
      ...r,
      category: v(f, r.kind + "_category"),
    }));
    const { data, error } = await client.rpc("import_transactions", {
      p_key: v(f, "key"),
      p_account: v(f, "account"),
      p_rows: payload,
      p_preview: mode === "preview",
    });
    if (error) throw new Error(error.message);
    const result = data as {
      imported: number;
      skipped: number;
      rows?: { status: string }[];
    };
    if (mode === "preview")
      return {
        preview: {
          imported: result.imported,
          skipped: result.skipped,
          rows: rows.map((r, i) => ({ ...r, status: result.rows![i].status })),
        },
      };
    revalidatePath("/", "layout");
    return {
      notice: `Imported ${result.imported} transaction(s). Skipped ${result.skipped} duplicate(s).`,
    };
  } catch (error) {
    return {
      error: (error instanceof Error
        ? error.message
        : "Unable to process this import."
      ).slice(0, 240),
    };
  }
}
async function recurringCall(
  f: FormData,
  name: string,
  args: Record<string, unknown>,
  notice: string,
) {
  const { client } = await session();
  const { error } = await client.rpc(name, { p_key: v(f, "key"), ...args });
  if (error)
    redirect(
      "/transactions/recurring?error=" +
        encodeURIComponent(error.message.slice(0, 200)),
    );
  revalidatePath("/", "layout");
  redirect("/transactions/recurring?notice=" + encodeURIComponent(notice));
}
export async function saveRecurring(f: FormData) {
  return recurringCall(
    f,
    "save_recurring",
    {
      p_id: v(f, "id") || null,
      p_revision: v(f, "revision") || null,
      p_data: Object.fromEntries(
        [
          "account",
          "category",
          "name",
          "kind",
          "amount",
          "description",
          "cadence",
          "date",
        ].map((k) => [k, v(f, k)]),
      ),
    },
    "Recurring schedule saved. No money was moved.",
  );
}
export async function toggleRecurring(f: FormData) {
  return recurringCall(
    f,
    "set_recurring_active",
    {
      p_id: v(f, "id"),
      p_revision: v(f, "revision"),
      p_active: v(f, "active") === "true",
    },
    "Schedule updated. No money was moved.",
  );
}
export async function resolveRecurring(f: FormData) {
  const mode = v(f, "mode");
  if (mode !== "post" && mode !== "skip")
    redirect("/transactions/recurring?error=Choose%20record%20or%20skip.");
  return recurringCall(
    f,
    "resolve_recurring",
    {
      p_id: v(f, "id"),
      p_revision: v(f, "revision"),
      p_due: v(f, "due"),
      p_date: v(f, "date"),
      p_skip: mode === "skip",
    },
    mode === "skip"
      ? "Occurrence skipped. No money was moved."
      : "Transaction recorded. The next due date has advanced.",
  );
}
export async function undoImport(f: FormData) {
  const { client } = await session();
  const { error } = await client.rpc("undo_import", {
    p_key: v(f, "key"),
    p_batch: v(f, "batch"),
    p_date: v(f, "date"),
  });
  if (error)
    redirect(
      "/transactions/import?error=" +
        encodeURIComponent(error.message.slice(0, 200)),
    );
  revalidatePath("/", "layout");
  redirect(
    "/transactions/import?notice=Import%20undone%20with%20reversals.%20Duplicate%20protection%20is%20retained.",
  );
}
