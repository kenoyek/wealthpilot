"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  accountIdentity,
  confirmPassword,
  proof,
  finishDeletion,
  cleanupToken,
  revokeAllSessions,
} from "@/lib/account-security";
import { neonAuth } from "@/lib/backend/neon-auth";
import { usesNeon } from "@/lib/backend/server";
import { deletionReceipt, receiptCredentials } from "@/lib/deletion-receipt";
const value = (f: FormData, k: string) => String(f.get(k) || "");
export async function signOutAll(f: FormData) {
  const identity = await accountIdentity();
  try {
    await confirmPassword(value(f, "currentPassword"), identity);
    await revokeAllSessions(identity);
  } catch {
    redirect(
      "/settings?error=Unable%20to%20sign%20out%20all%20devices.%20Check%20your%20current%20password%20or%20try%20again%20later.",
    );
  }
  redirect(
    "/login?notice=All%20device%20sessions%20were%20revoked.%20Sign%20in%20again.",
  );
}
export async function deleteAccount(f: FormData): Promise<{ error?: string }> {
  const identity = await accountIdentity();
  if (value(f, "confirmation") !== "DELETE MY ACCOUNT")
    return { error: "Type DELETE MY ACCOUNT exactly to confirm." };
  let purged = false;
  try {
    await confirmPassword(value(f, "currentPassword"), identity);
    const token = await cleanupToken();
    const result = await identity.client.rpc(
      "purge_my_workspace",
      proof(identity.user.id, "purge"),
    );
    if (result.error)
      throw new Error(
        "Deletion could not begin. Your data has not been deleted; please retry.",
      );
    purged = true;
    const jar = await cookies();
    jar.set(
      "wp_deletion_receipt",
      deletionReceipt(
        identity.user.id,
        process.env.WEALTHPILOT_SECURITY_SECRET || "",
        Math.floor(Date.now() / 1000),
        token,
      ),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      },
    );
    if (usesNeon()) {
      const r = await neonAuth().deleteUser({
        password: value(f, "currentPassword"),
      });
      if (r.error)
        throw new Error(
          "Your workspace was deleted and closed, but sign-in identity deletion could not finish. Retry with your current password.",
        );
    }
    try {
      await finishDeletion(identity.user.id, token);
      jar.delete("wp_deletion_receipt");
    } catch {
      redirect("/goodbye?cleanup=pending");
    }
    await identity.client.auth.signOut();
  } catch (error) {
    // Redirects intentionally escape through Next's control flow.
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    )
      throw error;
    return {
      error: purged
        ? "Your workspace is deleted and closed. Sign-in identity deletion or cleanup still needs to finish. Retry here, or use final cleanup after signing out."
        : error instanceof Error
          ? error.message
          : "Unable to delete this account.",
    };
  }
  redirect("/goodbye");
}
export async function retryCleanup() {
  const jar = await cookies(),
    receipt = jar.get("wp_deletion_receipt")?.value || "";
  const credentials = receiptCredentials(
    receipt,
    process.env.WEALTHPILOT_SECURITY_SECRET || "",
  );
  if (!credentials)
    redirect(
      "/goodbye?error=Cleanup%20receipt%20expired.%20Sign%20in%20to%20retry%20identity%20deletion%20or%20contact%20support.",
    );
  try {
    await finishDeletion(credentials.owner, credentials.token);
  } catch {
    redirect(
      "/goodbye?error=Cleanup%20could%20not%20finish.%20If%20your%20sign-in%20still%20exists%2C%20sign%20in%20and%20retry%20account%20deletion.",
    );
  }
  jar.delete("wp_deletion_receipt");
  redirect("/goodbye");
}
