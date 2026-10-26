import {
  privateRelease,
  ownerSetupAllowed,
  releaseSettings,
} from "@/lib/release-policy";
import { authenticate, recover, ownerVerification } from "../actions";
import { configured, usesNeon } from "@/lib/backend/server";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { redirect } from "next/navigation";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  if (!configured()) redirect("/setup");
  const q = await searchParams;
  return (
    <main className="auth auth-enhanced">
      <Link className="brand" href="/">
        ◈ WealthPilot
      </Link>
      <p className="auth-trust">
        A private workspace for every financial journey.
      </p>
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
        {usesNeon() && ownerSetupAllowed(releaseSettings().ownerEmail) && (
          <p className="notice">
            First visit: enter your owner email and choose a password, then
            select Set up owner account. Verify the emailed code below.
            Financial access opens after owner activation.
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
              maxLength={128}
              autoComplete="current-password"
              required
            />
          </label>
          <div className="actions">
            <SubmitButton name="mode" value="signin" pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
            {usesNeon() && ownerSetupAllowed(releaseSettings().ownerEmail) && (
              <SubmitButton
                name="mode"
                value="signup"
                secondary
                pendingLabel="Creating account…"
              >
                Set up owner account
              </SubmitButton>
            )}
            {!privateRelease() && (
              <SubmitButton
                name="mode"
                value="signup"
                secondary
                pendingLabel="Creating account…"
              >
                Create account
              </SubmitButton>
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
            <SubmitButton secondary>Send recovery email</SubmitButton>
          </form>
        </details>
        {usesNeon() && (
          <details>
            <summary>Verify email</summary>
            <form action={ownerVerification}>
              <label>
                Verification email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Email verification code
                <input
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                />
              </label>
              <div className="actions">
                <button name="mode" value="verify">
                  Verify email
                </button>
                <button name="mode" value="send" className="secondary">
                  Send new code
                </button>
              </div>
            </form>
          </details>
        )}
        <small>
          {privateRelease()
            ? "Private release. Access is limited to the verified owner account; public registration is disabled in this app."
            : "Create your account, verify your email, and get your own private workspace. Your records are never shared with other users."}
        </small>
      </section>
    </main>
  );
}
