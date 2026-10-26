import { usesNeon } from "@/lib/backend/server";
import Shell, { Notice } from "@/components/shell";
import { baseData } from "@/lib/data";
import { currencies } from "@/lib/money";
import { preferences, changePassword } from "../actions";
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { profile } = await baseData();
  return (
    <Shell
      active="/settings"
      title="Your preferences"
      subtitle="Make WealthPilot feel at home in your life."
    >
      <Notice {...await searchParams} />
      <div className="two-col">
        <section className="panel">
          <h2>The essentials</h2>
          <p>
            All financial onboarding questions are optional. Start with an
            account whenever you’re ready.
          </p>
          <form action={preferences}>
            <label>
              Reporting currency
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
                defaultValue={profile?.timezone || "Africa/Lagos"}
                required
                list="timezones"
              />
              <datalist id="timezones">
                {[
                  "Africa/Lagos",
                  "Europe/London",
                  "America/Toronto",
                  "America/New_York",
                  "Etc/UTC",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </datalist>
            </label>
            <p className="muted fine">
              Transaction effective dates stay as recorded when you change
              timezone. Different currencies are never silently combined.
            </p>
            <button>Save preferences</button>
          </form>
        </section>
        <section className="panel">
          <h2>Account security</h2>
          <form action={changePassword}>
            {usesNeon() && (
              <label>
                Current password
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}
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
            <button className="secondary">Update password</button>
          </form>
          <p className="muted fine">
            After following a recovery link, set your new password here. Your
            financial data is private to your sign-in.
          </p>
        </section>
      </div>
    </Shell>
  );
}
