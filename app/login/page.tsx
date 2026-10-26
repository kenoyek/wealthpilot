import { privateRelease } from "@/lib/release-policy";
import { authenticate, recover } from "../actions";
import { configured } from "@/lib/backend/server";
import { redirect } from "next/navigation";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  if (!configured()) redirect("/setup");
  const q = await searchParams;
  return (
    <main className="auth">
      <div className="brand">◈ WealthPilot</div>
      <section className="panel">
        <p className="eyebrow">YOUR MONEY. YOUR FINANCIAL FUTURE.</p>
        <h1>Make room for what matters.</h1>
        <p>
          Bring your income, everyday spending and bigger ambitions into one
          clear picture.
        </p>
        {q.error && (
          <p role="alert" className="error">
            {q.error}
          </p>
        )}
        {q.notice && (
          <p role="status" className="notice">
            {q.notice}
          </p>
        )}
        <form action={authenticate}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              autoComplete="current-password"
              required
            />
          </label>
          <div className="actions">
            <button name="mode" value="signin">
              Sign in
            </button>
            {!privateRelease() && (
              <button name="mode" value="signup" className="secondary">
                Create account
              </button>
            )}
          </div>
        </form>
        <details>
          <summary>Forgot your password?</summary>
          <form action={recover}>
            <label>
              Recovery email
              <input name="email" type="email" required />
            </label>
            <button className="secondary">Send recovery email</button>
          </form>
        </details>
        <small>
          {privateRelease()
            ? "Private release. Access is limited to the verified owner account; public registration is disabled in this app."
            : "Your financial records stay private to your account."}
        </small>
      </section>
    </main>
  );
}
