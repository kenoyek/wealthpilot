import Link from "next/link";
import Shell, { Notice } from "@/components/shell";
import { baseData } from "@/lib/data";
import { currencies } from "@/lib/money";
import { preferences, changePassword } from "../actions";
import { signOutAll } from "@/app/account/actions";
import { SubmitButton } from "@/components/submit-button";
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
      <p>
        <Link href="/install">Install WealthPilot on your phone</Link>
      </p>
      <div className="two-col">
        <section className="panel">
          <h2>The essentials</h2>
          <p>
            All financial onboarding questions are optional. Start with an
            account whenever you’re ready.
          </p>
          <form action={preferences}>
            <label>
              Display name
              <input
                name="display_name"
                autoComplete="given-name"
                maxLength={60}
                defaultValue={profile?.display_name || ""}
              />
            </label>
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
            <label>
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <SubmitButton secondary pendingLabel="Updating password…">
              Update password
            </SubmitButton>
          </form>
          <p className="muted fine">
            After following a recovery link, set your new password here. Your
            financial data is private to your sign-in.
          </p>
        </section>
      </div>
      <section className="panel" id="data">
        <h2>Your complete data export</h2>
        <p>
          Download all workspace records: accounts, the full journal,
          categories, budgets, planning records, recurring schedules, imports
          and audit history. Decimal amounts are strings so precision is
          preserved. Passwords, codes and session tokens are excluded.
        </p>
        <form action="/api/account/export" method="post">
          <div className="form-row">
            <label>
              Current password for export
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Download format
              <select aria-label="Download format" name="format">
                <option value="json">JSON</option>
                <option value="gzip">Compressed JSON (.json.gz)</option>
              </select>
            </label>
          </div>
          <button>Download complete export</button>
        </form>
        <p className="fine muted">
          Keep the downloaded file private. Larger exports are compressed
          automatically; an export that exceeds the transport limit fails
          explicitly rather than omitting records. Monthly CSV statements remain
          available in Reports.
        </p>
      </section>
      <section className="panel">
        <h2>Sign out all devices</h2>
        <p>
          Revoke all device sessions, including this one. You will need to sign
          in again. Security confirmations are limited across server instances
          to five attempts per 15-minute window.
        </p>
        <form action={signOutAll}>
          <label>
            Current password for session revocation
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <SubmitButton secondary pendingLabel="Revoking sessions…">
            Sign out all devices
          </SubmitButton>
        </form>
        <p className="fine muted">
          App session metadata may be cached for up to 30 seconds. An
          already-issued direct Data API token may remain valid until it
          expires; closing an account also blocks those tokens at the workspace
          identity layer.
        </p>
      </section>
      <section className="panel danger-zone">
        <h2>Delete account</h2>
        <p>
          Permanently remove your workspace and sign-in identity. Download an
          export first if you want a copy.
        </p>
        <Link className="button secondary" href="/account/deletion">
          Review account deletion
        </Link>
      </section>
    </Shell>
  );
}
