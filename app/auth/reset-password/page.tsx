import { redirect } from "next/navigation";
import { neonAuth, neonConfigured } from "@/lib/backend/neon-auth";
import { SubmitButton } from "@/components/submit-button";
async function reset(f: FormData) {
  "use server";
  if (!neonConfigured()) redirect("/login");
  const password = String(f.get("password") || "");
  const token = String(f.get("token") || "");
  if (
    password.length < 12 ||
    password.length > 128 ||
    !token ||
    token.length > 2048
  )
    redirect("/login?error=Invalid%20password%20reset%20request.");
  const r = await neonAuth().resetPassword({ newPassword: password, token });
  if (r.error)
    redirect("/login?error=Password%20reset%20link%20expired%20or%20invalid.");
  redirect(
    "/login?notice=Password%20updated.%20Sign%20in%20with%20your%20new%20password.",
  );
}
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const q = await searchParams;
  if (!neonConfigured() || !q.token || q.error)
    redirect("/login?error=Password%20reset%20link%20expired%20or%20invalid.");
  return (
    <main className="auth">
      <section className="panel">
        <h1>Reset your password</h1>
        <form action={reset}>
          <input type="hidden" name="token" value={q.token} />
          <label>
            New password
            <input
              name="password"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <SubmitButton>Set new password</SubmitButton>
        </form>
      </section>
    </main>
  );
}
