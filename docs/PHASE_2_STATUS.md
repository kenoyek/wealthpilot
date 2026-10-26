# Phase 2 — financial planning

Authorized by the owner's “Next phase” request. Local implementation only; no push, hosted deployment, external payment or destructive reset.

## Delivered workflows

- Savings and reserve goals linked to an asset account: target/date/priority, monthly contribution plan, manual contributions/releases, progress, required monthly contribution estimates and shortfalls. Emergency goals support a user-entered essential-spending baseline and explain months of coverage or missing data.
- A 30-day cash plan subtracts backed earmarks and uncovered recorded bills/debt minimums. Shared linked reserves offset their obligations once, not once per bill. Unrecorded obligations and future income are excluded; this is a planning estimate, not guaranteed affordability.
- Received-income allocation: saved reusable percentage templates, editable percentages, exact largest-remainder rounding, target caps, review before confirmation, live database capacity revalidation, auditable batch undo. Only unreversed received income qualifies. No bank money moves.
- Bills and subscriptions: one-time/weekly/monthly/quarterly/annual schedules, month-end anchors, optional/essential flags, same-account reserve links, actual-payment confirmation, due-date advancement, future-price changes with history, possible-duplicate name warnings, cancellation links and stop-tracking controls. Stopping tracking does not cancel a provider subscription; no usage claims are inferred.
- Debt register: existing-principal opening entries, monthly minimums and scenario APR, explicit principal/interest payment splits, partial-minimum handling, ordered payment undo, auditable terms updates and opening reversal after active payments are undone. Principal is a liability reduction, not an expense.
- Snowball/avalanche comparisons use deterministic decimal arithmetic, fixed monthly compounding assumptions, unchanged total payment budget, and a 1,200-month maximum horizon. They are illustrative estimates, not contractual schedules or promised outcomes.
- In-app bill, goal-contribution, debt-minimum and budget reminders; global enable/disable and lead days. Budgets have configurable additional milestone percentages, a custom threshold and per-budget disable control. No email, push or external reminder service is configured.
- Reports/CSV distinguish operating surplus (income minus expenses) from actual recorded cash movement. Opening adjustments and their reversals are excluded from cash movement; debt principal affects cash but not expenses.

## Database and security

Additive migrations 202610260003 through 202610260011 preserve existing records. New owner-scoped planning tables use RLS and composite ownership foreign keys. State changes use authenticated, idempotent, owner-locking RPCs with audited operations and revoked direct mutation. Internal helpers and the unchecked reversal helper are not exposed to API roles.

Deferred constraints reject negative or unbacked goal earmarks, including spending/transfers through Phase 1 RPCs. Release reserves before recording a payment from otherwise earmarked cash. Linked bill/debt payment RPCs consume their reserve atomically and restore it on undo. Generic reversal cannot bypass a planning payment's schedule update. Debt undo order uses an explicit sequence instead of transaction-start timestamps. Stale due dates and price quotes are rejected. Accounts with funded reserves, active commitments or outstanding debts cannot be archived.

Currency amounts remain NUMERIC/decimal strings. New views return monetary strings. The liability bucket extends the compact signed-line ledger; this is not a full commercial accounting system or revolving-credit account implementation.

## Acceptance evidence

Validated on 2026-10-26:

- 30 unit tests passed across money, calendar, allocation conservation, forecasts and debt strategy calculations.
- 28 database tests passed (26 child scenarios and two parent tests), with zero failures/skips. Includes Phase 1 regressions, cash backing, shared-reserve accounting, cross-user/anonymous denials, stale quotes, concurrent payments/allocations, debt principal/interest, ordered undo, opening reversal and configurable warning levels.
- Two production Chromium journeys passed: the existing account/expense/CSV/sign-out flow and the new income/goal/saved-template/allocation/bill/debt/report flow. Sampled report/debt pages passed automated accessibility checks; both journeys checked mobile overflow. This is not an application-wide accessibility certification.
- Production build, strict typecheck, lint and formatting checks passed.

Earlier browser attempts exposed exact-label matching problems for wrapped select controls; tests now use their accessible combobox names and wait for category-save results. One financial read failed while development schema was changing; the completed suite passes against the settled schema, and read failures log only table/error codes rather than financial payloads. No assertions were disabled or replaced with trivial checks.

## Limits and operating assumptions

- Manual actual-payment recording only. No provider payment execution, autopay, bank sync or client/invoice module.
- Recurring obligations may estimate missed cycles from the recorded next due date. Review stale subscriptions and stop tracking canceled items. Price updates affect the next unpaid cycle and future cycles; historical ledger payments retain their actual amounts.
- Goal monthly projections assume the first contribution today and monthly anniversaries thereafter; no returns or inflation. Future contributions are plans, not posted financial records.
- Allocation UI shows up to 50 eligible goals, latest 100 income receipts and latest 20 batches. Payment correction history shows latest 30 planning payments. Price history displays recent changes. These limits do not delete historical records.
- Budget and date reminders are computed when opening the app. There is no background delivery scheduler, regulated financial advice or claimed credit score.
- Scenario APR is a planning assumption; actual interest/fees come from the user's statement. Unpaid accrued interest is not independently inferred. Loan origination with a cash disbursement and general credit-card accounts require later ledger work.
- Hosted email verification/recovery, MFA, full privacy/deletion/legal controls, comprehensive abuse protection, backups/recovery drills, load testing and public launch remain outstanding from Phase 1.


The reusable installation and startup fields were confirmed saved in the environment draft. The installation script completed frozen installation, non-destructive backend startup, additive migrations and production build. The final template migration was also applied and its build/database/browser paths verified. Development startup returned the sign-in page with HTTP 200 and rejected unauthenticated planning access with a redirect to sign-in. Publishing this updated environment remains a user action in environment settings; no production deployment was performed.
