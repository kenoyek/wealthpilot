# Phase 1 implementation status

The owner approved the Phase 0 architecture on 2026-10-26. Implementation is local, with no remote push or production deployment.

## Implemented foundations
Next.js App Router, strict TypeScript, responsive light/dark UI, authenticated SSR sessions, Supabase Auth, profile preferences, asset accounts, named categories, personal/business scope, manual income/expense, same-currency transfers, linked refunds, audit-preserving reversals, fixed monthly budgets, report totals and CSV export.

The SQL migration uses owner-scoped RLS, composite foreign keys, revoked direct ledger mutation, decimal NUMERIC, explicit decimal-string views, transactional RPCs, deferred balancing constraints, owner locks and payload-aware idempotency. Refunds cannot exceed their source expense under concurrency. Each owner is limited to 60 postings/minute and 100 accounts. Negative balances remain visible. Opening entries do not count as income.

## Deliberate implementation boundaries
The proposed general ledger has been reduced to a compact signed-line model: assets have account IDs; income, expense and opening equity are counterpart buckets. Signed amounts sum to zero in the entry's single currency. This preserves the Phase 1 invariants, but later liability/FX expansion needs a reviewed migration into more general ledger accounts. No silent multi-currency netting is permitted now.

The proposed corrections are implemented as explicit reversal, followed by a separately submitted replacement. The original entry and reason remain visible. An atomic reversal/replacement wizard is not implemented. Currency definitions are a supported six-currency list, not yet a comprehensive ISO registry.

Auth email verification is intentionally disabled only for local testing. Production email configuration, recovery behavior with a real provider, MFA, reauthentication, distributed application request limits, recovery drills and public SaaS privacy workflows remain launch gates. Database posting throttles and Supabase Auth limits are present but not a complete Internet-facing abuse policy.

The UI uses system fonts, Lucide and custom CSS rather than adding Tailwind/shadcn wrappers without a need. It uses server forms instead of client React Hook Form/TanStack Query. Financial calculation and ownership boundaries remain unchanged. More complex interactive forms and charts can introduce the planned libraries where useful.

## Validation
See README for reproducible checks. Observed on 2026-10-26:

- 15 Vitest money/CSV/calendar tests passed.
- PostgreSQL/Supabase integration runner reported 13 passing tests (12 scenarios plus the parent test), with zero failures/skips. Includes two-user and anonymous boundaries, direct mutation denial, concurrent idempotency and over-refunds, reversal history, decimal validation, category/preferences validation, historical opening dates and the per-owner posting throttle.
- One Playwright production workflow passed using system Chromium: signup, opening account, expense entry, account/report reconciliation, CSV download, automated report-page accessibility scan, mobile overflow check and sign-out/unauthorized redirect. The first attempt lacked a wait for category-save completion; the test now waits for the resulting option before entering the next form. This does not weaken any assertions.
- Lint, strict typecheck, formatting check and production build passed.
- Production dependency audit reported zero known vulnerabilities; container images were not comprehensively security audited.
- Development sign-in route returned HTTP 200 with expected content. Repeating backend startup succeeded without resetting data.

Cloud setup required two corrections: supported TypeScript API checker mode because detached CLI output was empty, and ES module package mode for Turbopack development. Docker vfs exhausted disk on the original layered Supabase Postgres image; exporting the official immutable-digest filesystem and importing one layer resolved it, with runtime configuration (including healthcheck) verified. Helpers preserve TLS, checksums and registry verification. No credential values are recorded in these documents.

Auth email recovery was implemented but not exercised end-to-end against a mail provider. Automated accessibility scanning covered the report page, not the full application, and is not a WCAG conformance certification. No load tests, production security assessment, hosted integration tests, backup restore drill or production deployment were performed. No statement in the original Phase 0 documents should be read as claiming a feature is implemented.

The exact saved installation script was run successfully after validation: frozen install, tool activation, non-destructive backend startup and production build. Reusable install_script and start_skill fields were confirmed saved in the environment draft; publication has not been performed. Next.js generates AGENTS.md during development startup; it is retained as an expected project instruction file.
