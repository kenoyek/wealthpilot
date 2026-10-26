import { SubmitButton } from "@/components/submit-button";
import Shell, { Notice, Empty } from "@/components/shell";
import { baseData, localDate } from "@/lib/data";
import { currencies, formatMoney } from "@/lib/money";
import { addAccount, archiveAccount } from "../actions";
export default async function Accounts({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { accounts, profile } = await baseData();
  return (
    <Shell
      active="/accounts"
      title="Your accounts"
      subtitle="A home for every part of your financial life."
    >
      <Notice {...await searchParams} />
      <div className="two-col">
        <section className="panel">
          <h2>Account balances</h2>
          {accounts.length ? (
            <div className="account-list">
              {accounts.map((a) => (
                <div key={a.id}>
                  <span className="account-icon">{a.currency[0]}</span>
                  <div>
                    <b>{a.name}</b>
                    <small>
                      {a.scope} · {a.currency}
                      {a.archived ? " · archived" : ""}
                    </small>
                  </div>
                  <strong>{formatMoney(a.balance, a.currency)}</strong>
                  {!a.archived && (
                    <form action={archiveAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-button">Archive</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Start with one account">
              Add a bank account or cash wallet. Opening balances are recorded
              separately from income.
            </Empty>
          )}
          <p className="muted fine">
            Negative balances remain visible. Archived accounts retain their
            full history.
          </p>
        </section>
        <section className="panel">
          <h2>Add an account</h2>
          <form action={addAccount}>
            <label>
              Account name
              <input
                name="name"
                maxLength={80}
                placeholder="e.g. Everyday account"
                required
              />
            </label>
            <div className="form-row">
              <label>
                Currency
                <select
                  name="currency"
                  defaultValue={profile?.currency || "NGN"}
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Scope
                <select name="scope">
                  <option value="personal">Personal</option>
                  <option value="business">Business</option>
                </select>
              </label>
            </div>
            <label>
              Opening balance (optional)
              <input
                name="opening"
                inputMode="decimal"
                defaultValue="0"
                pattern="[0-9]+(\.[0-9]+)?"
              />
            </label>
            <label>
              Opening balance date
              <input
                type="date"
                name="date"
                defaultValue={localDate(profile?.timezone)}
                required
              />
            </label>
            <p className="fine muted">
              Enter a nonnegative opening asset balance. Credit and loan
              accounts are planned for a later phase.
            </p>
            <SubmitButton>Create account</SubmitButton>
          </form>
        </section>
      </div>
    </Shell>
  );
}
