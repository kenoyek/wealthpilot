# Insights and planning — 2026-10-28

The authenticated `/insights` page adds a 30-day cash-flow scenario, seven-month recorded spending history, a fair elapsed-day comparison with the previous month, leading spending categories, and current-month budget alerts. It is linked from the main navigation, dashboard quick actions and financial planning tabs. Android remains paused. This release requires no schema migration or production data rewrite.

## Calculation rules

- Cash forecasts use the existing owner-filtered `planning_positions` RPC. Recorded cash includes all posted entries, even future effective dates. Closing cash is recorded cash minus unpaid recorded obligations through the existing 30-day horizon (including overdue obligations), plus user-entered additional income, minus other expected spending.
- Room after reserves starts with the existing cash-plan `room`, which counts only obligations not already covered by linked reserves. The scenario adds/subtracts the same assumptions. Reserves are not subtracted a second time as if they were cash payments. Account shortfalls are retained rather than clamped; combined results do not transfer funds between accounts. Archived account balances are retained in matching currency/scope totals.
- This is an end-of-period scenario, not a dated liquidity guarantee or predictive model. Users explicitly enter additional income and spending; no income is invented from history. Existing debt-minimum estimates, partial payments, recurring bills and reserve coverage are inherited from the cash-plan RPC. New interest and unrecorded obligations are excluded.
- Assumptions live only in React component state: no URL parameters, browser storage, financial records, external service, or third-party analytics receive these inputs. Changing currency/scope or reloading starts a new scenario. Currency precision is validated; financial arithmetic remains Decimal-based.
- Trends use one explicitly paged journal window for six prior months plus the current month, with current effective dates through the profile-local date. Transfers, openings and principal are excluded by existing income/expense bucket semantics. Refunds and reversals net against their original bucket. Currencies and scopes remain separate. Missing records display as zero with explanatory text. The bar chart has an accessible description and adjacent exact-value table; negative net expenses appear in the table rather than negative bars.
- Month-to-date comparison uses the first N days of each month, where N is the lesser of today's day and the number of days in the previous month. This prevents comparing a full prior month with an incomplete current month. A zero or negative baseline has no percentage change.
- In-app budget alerts on Insights, Overview (current month only), and Budgets respect both profile `planning_alerts` and per-budget `alerts_enabled`. Over-budget alerts take priority over the highest crossed configured milestone, then pace alerts. Pace estimates begin on day seven and extrapolate net recorded spending evenly over the calendar month. Refunds reduce spending; future effective dates are excluded. No email/push/background delivery is added. Global reminder preferences are in Planning, budget-specific thresholds in Budgets.

## Privacy and operations

All reads use the existing authenticated session and RLS-enforced views/RPC; the new route is included in the Neon authentication middleware list. No elevated DB credential, new provider, new paid plan, staging branch, scheduler or notification service is needed. Existing sign-up and account isolation remain unchanged.

## Validation

New unit cases cover month/year boundaries, leap February, equal-day comparison, zero/negative baselines, separate currencies, refunds/reversals/transfers, custom alert milestones, alert switches, pace timing, future-date exclusion, reserve coverage, exact decimal amounts and preserved account shortfalls. A new local browser journey exercises signup, real ledger spending, a budget, an unpaid bill, interactive scenarios/errors, currency/scope filtering, reminder opt-out, sign-out and a second isolated workspace. It also scans accessibility and checks 320/390/650px layouts including visible Settings/Sign out. Browser fixtures refuse hosted backends; no production test accounts or transactions are created.

Release checks passed: 59 unit tests, all six local browser journeys, lint, typecheck, formatting and the production build.
