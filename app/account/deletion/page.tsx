import Link from "next/link";
import { accountIdentity } from "@/lib/account-security";
import { DeleteAccountForm } from "@/components/delete-account-form";
export default async function Deletion() {
  const { user } = await accountIdentity();
  return (
    <main className="auth auth-enhanced">
      <section className="panel">
        <p className="eyebrow">YOUR ACCOUNT, YOUR CONTROL</p>
        <h1>
          {user.closed ? "Finish account deletion" : "Delete your account"}
        </h1>
        <p>Signed in as {user.email}.</p>
        {user.closed ? (
          <p className="notice">
            Your financial workspace has been removed and old sessions cannot
            open it. Retry below to finish removing the sign-in identity.
          </p>
        ) : (
          <>
            <p className="error">
              This permanently removes all your WealthPilot accounts,
              transactions, budgets, goals, bills, debts, recurring schedules
              and import history, then your sign-in identity. It cannot be
              undone.
            </p>
            <p>
              <Link href="/settings#data">
                Download your complete data export first →
              </Link>
            </p>
          </>
        )}
        <p className="fine muted">
          This does not close bank accounts or cancel payments with your bank.
          Backups and provider logs may retain copies until their normal
          retention periods expire. Minimal closure metadata is kept only if
          identity cleanup needs a retry.
        </p>
        <DeleteAccountForm />
        <p>
          <Link href={user.closed ? "/goodbye" : "/settings"}>
            {user.closed
              ? "Final cleanup and sign-in help"
              : "Keep my account — return to Settings"}
          </Link>
        </p>
      </section>
    </main>
  );
}
