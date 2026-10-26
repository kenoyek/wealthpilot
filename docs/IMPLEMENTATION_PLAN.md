# Implementation plan and approval gate

## Phase 0 result
Repository audited; product, architecture, schema, financial rules and security boundaries proposed in the five companion documents. This folder is outside the protected checkout during cloud onboarding. No application source, dependencies, migrations or lockfiles were created. No server exists to start, and no tests exist to run. Read-only Git access succeeded; the repository has no remote refs or local commits. Node and npm availability alone does not establish application readiness.

## Decisions requiring approval before Phase 1
- Adopt Next.js + Supabase, a supported Node host initially, and an independent project lifecycle. Investigate Cloudflare adapter compatibility if Cloudflare is required.
- Adopt immutable double-entry postings with reversal/replacement, cash-basis reporting, decimal strings/NUMERIC and explicit historical FX.
- Accept the bounded Phase 1 scope: manual records and CSV export; imports, allocations, subscriptions, goals, invoices and AI ship later.
- Approve personal/business scope per entry/account, single-user ownership initially, and no household sharing until permission design is tested.

No Phase 1 implementation starts until architecture approval. Region, email provider, retention and production recovery objectives can be resolved during implementation but block public release. Product approval does not authorize production deployment or destructive migrations.

## Prioritized backlog
| Phase | Ordered work | Exit evidence |
| --- | --- | --- |
| 1 foundation | Select/pin dependencies; create Next.js skeleton; local/dedicated-dev Supabase; migrations; RLS; posting RPC; shared money helpers | Frozen install, typecheck/build, fresh migrations, ledger and two-user RLS integration tests |
| 1 usable MVP | Auth/recovery; preferences/skippable onboarding; accounts/categories; income/expense/transfer/refund/correction; budgets; reconciled dashboard/history/export | Real-record e2e journey, period and currency fixtures, responsive/keyboard review, export reconciliation |
| 2 planning | Reserve model, calendar recurrence, goals/acquisition costs, allocation preview/confirmation, bills/subscriptions/debt | No duplicate earmarking; deterministic rounding; missed dates/month-end and notification dedupe tests |
| 3 freelancer | Clients/projects, milestones, invoices/partial receipts, infrastructure allocation, FX margin | Receipts reconcile; unpaid invoices excluded from cash; ownership and margin fixtures |
| 4 intelligence | Forecast engine/scenarios, transparent health indicators, optional financial coach | Reproducible conservative/baseline/optimistic scenarios; grounded AI calculations and injection tests |
| 5 public SaaS | Entitlements, quotas, observability, deletion/export, legal/privacy review, recovery/load/security hardening | Isolation/load evidence, restore drill, incident runbook, launch approval |
| 6 mobile/integrations | PWA refinements, Capacitor, offline conflict design, authorized provider adapters | Platform secure-storage/sync tests; provider consent and duplicate-ingestion tests |

## First approved implementation sequence
1. Copy approved Phase 0 documents into repository docs in a separate coding task.
2. Choose exact supported package/CLI versions and generate committed manifests/lockfile.
3. Establish unit and real-Postgres test infrastructure before ledger code.
4. Implement schema, RLS and atomic posting, then prove invariants and isolation.
5. Add authenticated vertical slices in backlog order, keeping each slice operational.
6. Add dashboard/report/export from one reconciled query layer; run browser tests against production build.
7. Document actual commands, required environment bindings and deployment-specific limits, then update cloud setup instructions with tested steps.

## Environment and dependency requirements
No install is required for reviewing Markdown. Future npm installation needs registry.npmjs.org (included in package-manager network preset). Supabase managed development requires its project-specific HTTPS hostname and approved credentials; local development requires a usable Docker daemon, Supabase CLI and image registry access. Docker daemon and registries have not been validated. No credentials should be requested until the actual selected workflow is implemented and existing bindings are checked. Future Supabase CLI downloads and browser runtimes may require additional exact hosts based on observed requests; do not broaden network access speculatively.

## Validation reporting
For every phase report implemented features, migrations, security controls, commands and counts actually executed, failed/skipped checks, limitations and next dependencies. Do not classify compile-only success as feature readiness. Architecture review currently requires no application installation; runtime readiness is intentionally unverified until code exists.
