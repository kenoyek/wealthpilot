import "server-only";
import { redirect } from "next/navigation";
import { db, usesNeon } from "./backend/server";
import { db as localDb } from "./supabase/server";
import { neonAuth } from "./backend/neon-auth";
import { sessionAllowed } from "./release-policy";
import { securityProof } from "./security-proof";
export async function accountIdentity() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (
    !user ||
    !sessionAllowed(
      user.email,
      Boolean(user.email_verified || user.email_confirmed_at),
    )
  )
    redirect("/login");
  return { client, user };
}
export async function confirmPassword(
  password: string,
  identity: Awaited<ReturnType<typeof accountIdentity>>,
) {
  if (password.length < 12 || password.length > 128)
    throw new Error("Enter your current password.");
  const gate = await identity.client.rpc("security_attempt");
  if (gate.error || !gate.data)
    throw new Error(
      "Too many security attempts or verification is unavailable. Try again in 15 minutes.",
    );
  if (usesNeon()) {
    const server = neonAuth(),
      before = await server.getSession();
    if (!before.data?.user) throw new Error("Sign in again before continuing.");
    const result = await server.signIn.email({
      email: before.data.user.email,
      password,
    });
    if (result.error || result.data?.user.id !== before.data.user.id)
      throw new Error("Current password could not be verified.");
  } else {
    const local = await localDb();
    const result = await local.auth.signInWithPassword({
      email: identity.user.email!,
      password,
    });
    if (result.error || result.data.user?.id !== identity.user.id)
      throw new Error("Current password could not be verified.");
  }
}
export function proof(owner: string, purpose: "purge" | "finish" | "export") {
  return securityProof(
    owner,
    purpose,
    process.env.WEALTHPILOT_SECURITY_SECRET || "",
  );
}
export async function cleanupToken() {
  if (usesNeon()) {
    const r = await neonAuth().token();
    if (r.error || !r.data?.token)
      throw new Error("Unable to prepare secure account cleanup.");
    return r.data.token;
  }
  const r = await (await localDb()).auth.getSession();
  if (!r.data.session?.access_token)
    throw new Error("Sign in again before deleting your account.");
  return r.data.session.access_token;
}
export async function finishDeletion(owner: string, token: string) {
  const base = usesNeon()
    ? process.env.NEON_DATA_API_URL!
    : process.env.NEXT_PUBLIC_SUPABASE_URL! + "/rest/v1";
  const response = await fetch(
    base.replace(/\/$/, "") + "/rpc/finish_account_deletion",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(!usesNeon()
          ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! }
          : {}),
      },
      body: JSON.stringify(proof(owner, "finish")),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(
      "Final cleanup could not be confirmed. Retry promptly; if the cleanup token has expired, contact support.",
    );
}
export async function revokeAllSessions(
  identity: Awaited<ReturnType<typeof accountIdentity>>,
) {
  if (usesNeon()) {
    const r = await neonAuth().revokeSessions();
    if (r.error) throw new Error("Unable to revoke sessions. Please retry.");
  } else {
    const r = await (await localDb()).auth.signOut({ scope: "global" });
    if (r.error) throw new Error("Unable to revoke sessions. Please retry.");
  }
  await identity.client.auth.signOut();
}
