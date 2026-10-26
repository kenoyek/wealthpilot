import Link from "next/link";
import { redirect } from "next/navigation";
import { baseData } from "@/lib/data";
import { currencies } from "@/lib/money";
import { Notice } from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
import { finishOnboarding } from "../actions";
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await baseData();
  if (profile?.onboarded) redirect("/dashboard");
  return (
    <main className="auth onboarding">
      <Link className="brand" href="/dashboard">
        ◈ WealthPilot
      </Link>
      <section className="panel">
        <p className="eyebrow">YOUR WORKSPACE, YOUR WAY</p>
        <h1>Make yourself at home.</h1>
        <p>
          Choose how you see your money. Start with one account, or add it
          later. We’ve prepared useful categories for you.
        </p>
        <Notice {...await searchParams} />
        <form action={finishOnboarding}>
          <label>
            What should we call you?
            <input
              name="display_name"
              autoComplete="given-name"
              required
              maxLength={60}
              defaultValue={profile?.display_name || ""}
            />
          </label>
          <div className="form-grid">
            <label>
              Home currency
              <select name="currency" defaultValue={profile?.currency || "NGN"}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Timezone
              <input
                name="timezone"
                required
                defaultValue={profile?.timezone || "Africa/Lagos"}
                list="zones"
              />
              <datalist id="zones">
                {[
                  "Africa/Lagos",
                  "Africa/Accra",
                  "Africa/Nairobi",
                  "Africa/Johannesburg",
                  "Europe/London",
                  "Europe/Berlin",
                  "America/New_York",
                  "America/Toronto",
                  "America/Los_Angeles",
                  "Asia/Dubai",
                  "Asia/Kolkata",
                  "Australia/Sydney",
                  "Etc/UTC",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </datalist>
            </label>
          </div>
          <h2>
            Your first account <span className="muted fine">optional</span>
          </h2>
          <label>
            Account name
            <input
              name="account_name"
              placeholder="e.g. Everyday bank account"
              maxLength={80}
            />
          </label>
          <label>
            Current balance
            <input
              name="opening"
              inputMode="decimal"
              defaultValue="0"
              pattern="[0-9]+([.][0-9]+)?"
            />
          </label>
          <p className="muted fine">
            Use your actual balance, or leave it at zero. Opening balances
            aren’t counted as income. You can track other currencies separately
            later.
          </p>
          <SubmitButton>Create my workspace</SubmitButton>
        </form>
        <p>
          <Link href="/dashboard">Skip for now →</Link>
        </p>
      </section>
    </main>
  );
}
