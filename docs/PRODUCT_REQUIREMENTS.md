# WealthPilot product requirements

Status: proposed architecture; Phase 1 requires owner approval. No application has been implemented.

## Repository audit
The selected kenoyek/wealthpilot checkout at /workspace/wealthpilot contains only Git metadata, has symbolic branch work with no commits, and exposes no remote refs through a successful read-only Git query. There are no manifests, lockfiles, scripts, CI workflows, source files, or repository agent instructions. Node 24.19.0, npm 11.9.0, Python 3.12.14 and a Docker executable are present. Docker daemon capability has not been tested. No database or Supabase CLI is installed. Existing documentation imposes no technical constraints.

## Product and users
WealthPilot gives people with irregular income a reliable account of cash, commitments and progress toward wealth goals. Primary audience: Nigerian freelancers and developers; support other professions and countries without copying the owner's personal records. Independent repository, authentication, database and deployment lifecycle. NGN is an onboarding suggestion, never a global currency assumption.

## Phase 1 scope
Independent sign-up/sign-in, verified email, password reset, profiles, skippable onboarding, currency/timezone preferences, financial accounts, editable category templates, manual income/expense/refund/transfer entry, monthly category budgets, transaction search/history, a reconciled dashboard, monthly reports and CSV export. Opening balances are explicit ledger entries. Include audit-preserving corrections and archive accounts rather than deleting history. Support personal/business scopes from the first schema. Phase 1 accounts use one selected currency each; foreign-currency transactions and transfers require an explicit recorded rate. If unavailable, show separate currency totals and an incomplete consolidated total.

All real-user screens begin empty. Demo mode is clearly labeled, isolated from real accounts, and never writes into a signed-in user's ledger. No bank connections, payment initiation, custody, AI, invoices, goal allocations, household sharing or billing in Phase 1. CSV/statement import is deferred until staging, duplicate detection and reconciliation rules are implemented; CSV export is included initially. This narrows the broader blueprint and requires approval.

## Main workflows and acceptance
1. A new user can skip all financial onboarding questions and reach an empty dashboard.
2. A user records income or an expense and observes matching account, dashboard and report changes.
3. A transfer changes two account balances atomically without changing income or expenses.
4. A refund references an original expense, reduces net spending and retains a separate visible record.
5. A correction reverses and replaces a posted entry with a recorded reason; original history remains readable.
6. Monthly budget usage follows the user's timezone and selected personal/business scope. Configurable thresholds never imply money moved.
7. Users can export only their own records, with explicit currency, scope and effective date. Export totals reconcile with reports.
8. User A cannot read or mutate User B's rows, attachments, RPC inputs or exports, even with guessed identifiers.
9. A concurrency retry cannot create duplicate postings; failed multi-leg writes leave no partial ledger.
10. Keyboard navigation, labeled errors, responsive layouts and WCAG 2.2 AA as a target are verified for core flows; this is not a certification claim.

## Later outcomes
Phase 2: goals (including land acquisition costs), protected reserves, income allocation, bills, debts and subscriptions. Phase 3: clients, receivables and project profitability, with recurring infrastructure costs. Phase 4: deterministic forecasts, financial health indicators and optional AI explanations. Phase 5: public SaaS hardening and entitlements. Phase 6: mobile and authorized read-only integrations.

## Open decisions
Approve the architecture, phased scope, export/import split, ledger correction model, conservative cash accounting and deployment choice before implementation. Currency, personal/business scope, country and timezone are per-user choices. Tax reserves are user-configured planning amounts, never inferred legal advice. Terms, retention periods, regional hosting, email provider and legal assessment must be chosen before public launch.
