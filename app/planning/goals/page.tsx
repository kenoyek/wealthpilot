import Decimal from "decimal.js";
import Shell, { Notice, Empty } from "@/components/shell";
import { PlanningNav, RequestKey, AccountSelect } from "@/components/planning";
import { SubmitButton } from "@/components/submit-button";
import { planningData } from "@/lib/planning-data";
import { localDate } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { goalProjection } from "@/lib/planning";
import { saveGoal, fundGoal } from "../actions";
export default async function Goals({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { accounts, goals, profile } = await planningData();
  const today = localDate(profile?.timezone);
  const account = (id: string) => accounts.find((a) => a.id === id)!;
  function fields(g?: (typeof goals)[number]) {
    return (
      <>
        <RequestKey />
        {g && <input type="hidden" name="id" value={g.id} />}
        <label>
          Goal name
          <input
            name="name"
            maxLength={80}
            defaultValue={g?.name}
            placeholder="e.g. Land deposit including legal fees"
            required
          />
        </label>
        {g ? (
          <input type="hidden" name="account" value={g.account_id} />
        ) : (
          <AccountSelect accounts={accounts} />
        )}
        <div className="form-row">
          <label>
            Purpose
            <select name="kind" defaultValue={g?.kind || "goal"}>
              <option value="goal">Savings goal</option>
              <option value="emergency">Emergency reserve</option>
              <option value="tax">Tax reserve</option>
              <option value="operating">Business operating reserve</option>
              <option value="obligation">Bills reserve</option>
            </select>
          </label>
          <label>
            Priority (1 is highest)
            <input
              name="priority"
              type="number"
              min={1}
              max={5}
              defaultValue={g?.priority || 1}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Target amount
            <input
              name="target"
              inputMode="decimal"
              defaultValue={g?.target}
              required
            />
          </label>
          <label>
            Target date
            <input
              name="date"
              type="date"
              defaultValue={g?.target_date}
              required
            />
          </label>
        </div>
        <label>
          Planned monthly contribution (optional)
          <input
            name="monthly"
            inputMode="decimal"
            defaultValue={g?.monthly_plan || "0"}
          />
        </label>
        <label>
          Essential monthly spending baseline (emergency planning)
          <input
            name="essential"
            inputMode="decimal"
            defaultValue={g?.essential_monthly || "0"}
          />
        </label>
        <p className="fine muted">
          Amounts use the account’s currency. Include purchase costs in your
          target. Monthly plans are reminders, never automatic transfers.
        </p>
        <SubmitButton>Save goal</SubmitButton>
      </>
    );
  }
  return (
    <Shell
      active="/planning"
      title="Savings & reserves"
      subtitle="Give today’s cash a purpose and tomorrow’s ambitions a plan."
    >
      <PlanningNav />
      <Notice {...await searchParams} />
      <details className="panel" open={!goals.length}>
        <summary>Create a savings goal or reserve</summary>
        {accounts.some((a) => !a.archived) ? (
          <form action={saveGoal}>{fields()}</form>
        ) : (
          <p>Add an account first.</p>
        )}
      </details>
      <div className="goal-grid">
        {goals.map((g) => {
          const a = account(g.account_id),
            p = goalProjection(
              g.target,
              g.funded,
              g.target_date,
              today,
              a.currency,
              g.monthly_plan,
            );
          const progress = new Decimal(g.funded).div(g.target).mul(100);
          return (
            <section className="panel" key={g.id}>
              <div className="section-heading">
                <div>
                  <h2>{g.name}</h2>
                  <p>
                    {a.name} · {g.kind} · priority {g.priority}
                  </p>
                </div>
                <span className="pill">{progress.toFixed(0)}% funded</span>
              </div>
              <strong className="planning-amount">
                {formatMoney(g.funded, a.currency)}
              </strong>
              <p className="fine">
                of {formatMoney(g.target, a.currency)} · due {g.target_date}
              </p>
              <div className="track">
                <div
                  className="fill"
                  style={{ width: progress.clamp(0, 100).toFixed(2) + "%" }}
                />
              </div>
              <p className="fine">
                {p.required === null
                  ? "Target date passed: " +
                    formatMoney(p.gap, a.currency) +
                    " shortfall"
                  : p.months
                    ? formatMoney(p.required!, a.currency) +
                      " needed per contribution date (" +
                      p.months +
                      " dates remain)"
                    : "Target funded"}
              </p>
              {new Decimal(g.monthly_plan).gt(0) && (
                <p className="fine muted">
                  Planned {formatMoney(g.monthly_plan, a.currency)}/month ·
                  estimated deadline gap{" "}
                  {formatMoney(p.plannedShortfall, a.currency)}
                </p>
              )}
              {g.kind === "emergency" && (
                <p className="notice">
                  {new Decimal(g.essential_monthly).gt(0)
                    ? new Decimal(g.funded)
                        .div(g.essential_monthly)
                        .toFixed(1) + " months of essential spending covered."
                    : "Add a monthly essential-spending baseline to calculate coverage."}
                </p>
              )}
              <form action={fundGoal} className="inline-form">
                <RequestKey />
                <input type="hidden" name="goal" value={g.id} />
                <label>
                  Action
                  <select name="mode">
                    <option value="fund">Add contribution</option>
                    <option value="release">Release reserve</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input name="amount" inputMode="decimal" required />
                </label>
                <SubmitButton>Confirm reserve change</SubmitButton>
              </form>
              <p className="fine muted">
                Contribution estimates assume one contribution today, then
                monthly on today’s day-of-month, without inflation or returns.
                This earmarks existing cash in {a.name}. It does not move money.
                Contributions can reduce room for upcoming bills; review Cash &
                reminders.
              </p>
              <details>
                <summary>Edit goal</summary>
                <form action={saveGoal}>{fields(g)}</form>
              </details>
            </section>
          );
        })}
      </div>
      {!goals.length && (
        <Empty title="Build toward something meaningful">
          Start with an emergency buffer, land, a car or a goal of your own.
        </Empty>
      )}
    </Shell>
  );
}
