import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { neonAuth, neonConfigured } from "@/lib/backend/neon-auth";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (neonConfigured()) {
    const path = request.nextUrl.pathname;
    if (
      [
        "/dashboard",
        "/onboarding",
        "/accounts",
        "/transactions",
        "/budgets",
        "/planning",
        "/reports",
        "/insights",
        "/settings",
        "/api/export",
      ].some((p) => path === p || path.startsWith(p + "/"))
    )
      return neonAuth().middleware({ loginUrl: "/login" })(request);
    return response;
  }
  if (
    process.env.NEON_AUTH_BASE_URL ||
    process.env.NEON_DATA_API_URL ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  )
    return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
