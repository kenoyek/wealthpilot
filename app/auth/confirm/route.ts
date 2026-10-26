import { NextRequest, NextResponse } from "next/server";
import { db, usesNeon } from "@/lib/backend/server";
import { sessionAllowed } from "@/lib/release-policy";
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const client = await db();
  async function approvedRedirect(path: string) {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (
      !user ||
      !sessionAllowed(
        user.email,
        Boolean(user.email_verified || user.email_confirmed_at),
      )
    ) {
      await client.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=Owner%20invitation%20required.", url.origin),
      );
    }
    return NextResponse.redirect(new URL(path, url.origin));
  }
  if (usesNeon()) return approvedRedirect("/settings");
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return approvedRedirect("/settings");
  }
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (token_hash && type && ["signup", "recovery", "email"].includes(type)) {
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "recovery" | "email",
    });
    if (!error)
      return approvedRedirect(type === "recovery" ? "/settings" : "/dashboard");
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=Confirmation%20link%20expired%20or%20invalid.",
      url.origin,
    ),
  );
}
