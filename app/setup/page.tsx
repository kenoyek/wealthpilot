import Link from "next/link";
import { usesNeon } from "@/lib/backend/server";
export default function Setup() {
  return (
    <main className="auth">
      <div className="brand">◈ WealthPilot</div>
      <section className="panel">
        <p className="eyebrow">DEVELOPMENT SETUP</p>
        <h1>A secure home for your finances.</h1>
        <p>
          Configure the selected database and authentication backend before
          signing in. No sample balances are shown as your money.
        </p>
        {usesNeon() ? (
          <p>
            Neon Auth, Data API and cookie-signing settings are required. Follow
            the deployment guide; local test bindings are not production
            configuration.
          </p>
        ) : (
          <ol>
            <li>
              Run <code>npm run db:start</code>.
            </li>
            <li>
              Run <code>npm run env:local</code>.
            </li>
            <li>Restart the development server.</li>
          </ol>
        )}
        <p>Full instructions are in the repository README.</p>
        <Link className="button" href="/login">
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}
