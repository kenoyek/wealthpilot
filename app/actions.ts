"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/backend/server";
import { neonAuth, neonConfigured } from "@/lib/backend/neon-auth";
import { authRequestAllowed } from "@/lib/auth-requests";
import { session } from "@/lib/session";
import { amount, monthBounds } from "@/lib/money";
import { confirmPassword } from "@/lib/account-security";
import {
  privateRelease,
  ownerSetupAllowed,
  ownerEmailAllowed,
  privateSignInMessage,
} from "@/lib/release-policy";
const field = (f: FormData, k: string) => String(f.get(k) || "");
const uuid = (s: string) => z.uuid().parse(s);
function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message.slice(0, 180))}`);
}
function message(e: unknown) {
  return e instanceof Error ? e.message : "The request could not be completed.";
}
function refresh() {
  revalidatePath("/", "layout");
}
export async function authenticate(f: FormData) {
  const email = field(f, "email").trim().toLowerCase(),
    password = field(f, "password"),
    mode = field(f, "mode");
  if (
    !z.email().safeParse(email).success ||
    password.length < 12 ||
    password.length > 128
  )
    fail(
      "/login",
      "Use a valid email and a password of at least 12 characters.",
    );
  if (mode !== "signin" && mode !== "signup")
    fail("/login", privateSignInMessage);
  if (
    privateRelease() &&
    (!ownerEmailAllowed(email) ||
      (mode === "signup" && !(neonConfigured() && ownerSetupAllowed(email))))
  )
    fail("/login", privateSignInMessage);
  if (!(await authRequestAllowed(mode, email)))
    fail("/login", "Too many attempts. Please try again in 15 minutes.");
  const client = await db();
  const origin = (await headers()).get("origin") || "http://127.0.0.1:3000";
  const result =
    mode === "signup"
      ? await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: origin + "/auth/confirm" },
        })
      : await client.auth.signInWithPassword({ email, password });
  if (result.error)
    fail(
      "/login",
      privateRelease()
        ? privateSignInMessage
        : mode === "signup"
          ? "Unable to create an account. Check your details, or sign in if you already registered."
          : "Unable to sign in. Check your credentials and verify your email.",
    );
  if (mode === "signup" && neonConfigured())
    redirect(
      "/login?notice=Check%20your%20email%20for%20a%20verification%20code.%20Use%20Verify%20email%20below.",
    );
  if (mode === "signup" && !result.data.session)
    redirect(
      "/login?notice=Check%20your%20email%20to%20confirm%20your%20account.",
    );
  redirect("/dashboard");
}
export async function signout() {
  const client = await db();
  const result = await client.auth.signOut();
  if (result.error)
    fail("/settings", "Unable to finish sign-out. Please retry.");
  redirect("/login");
}
export async function recover(f: FormData) {
  const email = field(f, "email").trim().toLowerCase();
  if (!z.email().safeParse(email).success)
    fail("/login", "Enter a valid email.");
  if (!ownerEmailAllowed(email))
    redirect(
      "/login?notice=If%20that%20account%20exists%2C%20a%20recovery%20email%20has%20been%20sent.",
    );
  if (!(await authRequestAllowed("recover", email)))
    fail("/login", "Too many attempts. Please try again in 15 minutes.");
  const client = await db();
  const origin = (await headers()).get("origin") || "http://127.0.0.1:3000";
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: origin + "/auth/confirm",
  });
  if (error)
    console.error("Recovery request failed", { code: "PROVIDER_RECOVERY" });
  redirect(
    "/login?notice=If%20that%20account%20exists%2C%20a%20recovery%20email%20has%20been%20sent.",
  );
}
export async function changePassword(f: FormData) {
  const identity = await session();
  const { client } = identity;
  const password = field(f, "password");
  if (password.length < 12 || password.length > 128)
    fail("/settings", "Use 12 to 128 characters.");
  try {
    await confirmPassword(field(f, "currentPassword"), identity);
  } catch {
    fail(
      "/settings",
      "Current password could not be verified, or the security attempt limit was reached.",
    );
  }
  const { error } = await client.auth.updateUser({
    password,
    currentPassword: field(f, "currentPassword"),
  });
  if (error) fail("/settings", error.message);
  redirect("/settings?notice=Password%20updated.");
}
export async function preferences(f: FormData) {
  const { client, user } = await session();
  try {
    const timezone = field(f, "timezone");
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    const { error } = await client.from("profiles").upsert({
      id: user.id,
      display_name: z.string().trim().max(60).parse(field(f, "display_name")),
      currency: field(f, "currency"),
      timezone,
      onboarded: true,
    });
    if (error) throw error;
  } catch {
    fail("/settings", "Choose a supported currency and valid IANA timezone.");
  }
  refresh();
  redirect("/dashboard");
}
export async function addAccount(f: FormData) {
  const { client } = await session();
  try {
    const opening = field(f, "opening") || "0";
    if (opening !== "0") amount(opening, field(f, "currency"));
    const { error } = await client.rpc("create_account", {
      p_name: field(f, "name"),
      p_currency: field(f, "currency"),
      p_scope: field(f, "scope"),
      p_opening: opening,
      p_date: field(f, "date"),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    fail("/accounts", message(e));
  }
  refresh();
  redirect("/accounts");
}
export async function archiveAccount(f: FormData) {
  const { client } = await session();
  const { error } = await client.rpc("archive_account", {
    p_id: uuid(field(f, "id")),
  });
  if (error) fail("/accounts", error.message);
  refresh();
  redirect("/accounts");
}
export async function addCategory(f: FormData) {
  const { client, user } = await session();
  const { error } = await client.from("categories").insert({
    owner_id: user.id,
    name: field(f, "name"),
    kind: field(f, "kind"),
    scope: field(f, "scope"),
  });
  if (error) fail("/transactions", error.message);
  revalidatePath("/transactions");
}
export async function postEntry(
  f: FormData,
): Promise<{ error?: string; notice?: string }> {
  const { client } = await session();
  try {
    const kind = field(f, "kind");
    const account = uuid(field(f, "account"));
    const { data, error: readError } = await client
      .from("accounts")
      .select("currency")
      .eq("id", account)
      .single();
    if (readError || !data) throw new Error("Account unavailable.");
    const value = amount(field(f, "amount"), data.currency);
    const { error } = await client.rpc("post_entry", {
      p_key: uuid(field(f, "key")),
      p_kind: kind,
      p_account: account,
      p_amount: value,
      p_date: field(f, "date"),
      p_description: field(f, "description"),
      p_category: field(f, "category") || null,
      p_destination: field(f, "destination") || null,
      p_related: field(f, "related") || null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return { error: message(e).slice(0, 180) };
  }
  refresh();
  return { notice: "Transaction recorded." };
}
export async function reverseEntry(f: FormData) {
  const { client } = await session();
  const { error } = await client.rpc("reverse_entry", {
    p_id: uuid(field(f, "id")),
    p_key: uuid(field(f, "key")),
    p_date: field(f, "date"),
    p_reason: field(f, "reason"),
  });
  if (error) fail("/transactions", error.message);
  refresh();
  redirect(
    "/transactions?notice=Reversed.%20Add%20a%20replacement%20entry%20if%20needed.",
  );
}
export async function saveBudget(f: FormData) {
  const { client, user } = await session();
  try {
    const { start } = monthBounds(field(f, "month"));
    const currency = field(f, "currency");
    const value = amount(field(f, "amount"), currency);
    const { data: category } = await client
      .from("categories")
      .select("kind")
      .eq("id", uuid(field(f, "category")))
      .single();
    if (category?.kind !== "expense")
      throw new Error("Choose an expense category.");
    const warning_levels = z
      .array(z.number().int().min(1).max(100))
      .max(10)
      .parse(
        field(f, "levels")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number),
      );
    const { error } = await client.from("budgets").upsert(
      {
        owner_id: user.id,
        category_id: field(f, "category"),
        month: start,
        currency,
        amount: value,
        threshold: Number(field(f, "threshold")),
        warning_levels,
        alerts_enabled: field(f, "alerts") !== "false",
      },
      { onConflict: "owner_id,category_id,month,currency" },
    );
    if (error) throw new Error(error.message);
  } catch (e) {
    fail("/budgets", message(e));
  }
  refresh();
  redirect("/budgets");
}
export async function renameCategory(f: FormData) {
  const { client } = await session();
  const { error } = await client
    .from("categories")
    .update({ name: field(f, "name") })
    .eq("id", uuid(field(f, "id")));
  if (error) fail("/transactions", error.message);
  refresh();
  redirect("/transactions");
}

export async function ownerVerification(f: FormData) {
  const email = field(f, "email").trim().toLowerCase();
  if (
    !neonConfigured() ||
    !z.email().safeParse(email).success ||
    !ownerEmailAllowed(email)
  )
    fail("/login", "Unable to verify this account.");
  if (!["send", "verify"].includes(field(f, "mode")))
    fail("/login", "Invalid verification request.");
  if (!(await authRequestAllowed("verify-" + field(f, "mode"), email)))
    fail("/login", "Too many attempts. Please try again in 15 minutes.");
  const auth = neonAuth();
  const otp = field(f, "otp").trim();
  if (field(f, "mode") === "send") {
    await auth.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    redirect(
      "/login?notice=If%20the%20account%20exists%2C%20a%20verification%20code%20has%20been%20sent.",
    );
  }
  if (!/^\d{6}$/.test(otp))
    fail("/login", "Enter the six-digit email verification code.");
  const result = await auth.emailOtp.verifyEmail({ email, otp });
  if (result.error)
    fail("/login", "Verification code expired or invalid. Request a new code.");
  redirect("/onboarding");
}

export async function finishOnboarding(f: FormData) {
  const { client } = await session();
  const { localDate } = await import("@/lib/data");
  try {
    const timezone = field(f, "timezone");
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    const { error } = await client.rpc("complete_onboarding", {
      p_name: z.string().trim().min(1).max(60).parse(field(f, "display_name")),
      p_currency: field(f, "currency"),
      p_timezone: timezone,
      p_account: field(f, "account_name").trim(),
      p_opening: field(f, "opening") || "0",
      p_date: localDate(timezone),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    fail("/onboarding", message(e));
  }
  refresh();
  redirect("/dashboard?welcome=1");
}
