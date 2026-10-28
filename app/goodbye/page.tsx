import Link from "next/link";
import { cookies } from "next/headers";
import { receiptOwner } from "@/lib/deletion-receipt";
import { retryCleanup } from "@/app/account/actions";
import { SubmitButton } from "@/components/submit-button";
export default async function Goodbye({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  const receipt = (await cookies()).get("wp_deletion_receipt")?.value || "";
  const pending = !!receiptOwner(
    receipt,
    process.env.WEALTHPILOT_SECURITY_SECRET || "",
  );
  return (
    <main className="auth">
      <section className="panel">
        <h1>{pending ? "Finish final cleanup" : "You’re in control."}</h1>
        {q.error && (
          <p className="error" role="alert">
            {q.error}
          </p>
        )}
        {pending ? (
          <>
            <p>
              Your financial workspace has been removed. Final identity cleanup
              has not yet been confirmed.
            </p>
            <form action={retryCleanup}>
              <SubmitButton>Retry final cleanup</SubmitButton>
            </form>
            <p>
              If sign-in identity deletion is still pending,{" "}
              <Link href="/login">sign in</Link> and retry account deletion with
              your password.
            </p>
          </>
        ) : (
          <p>
            Your deletion request has finished if you arrived here after
            deleting your account. You can close this page.
          </p>
        )}
        <p>
          <Link href="/">Return to WealthPilot</Link>
        </p>
      </section>
    </main>
  );
}
