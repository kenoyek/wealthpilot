# Web experience and verified registration — 2026-10-26

The owner authorized improving the existing live web app and enabling other people to register, without a staging deployment. Android development/downloads are paused. Existing identities and ledger history are preserved; no account, transaction or authentication record was reset.

## Delivered behavior

- Public home page explains actual account, spending, reporting and cash-planning features without fabricated balances or unsupported bank integrations.
- Production supports self-service registration with Neon email OTP verification. The app's sole-owner gate is opened only when `WEALTHPILOT_PUBLIC_SIGNUP=true` AND `WEALTHPILOT_PRIVATE_RELEASE=false`. Previews remain private. Owner-setup signup stays disabled; the admin/signup proxy endpoints remain blocked, with registration handled through the validated server action.
- The verified native subject automatically receives a stable internal UUID, profile and ten useful personal/business categories. No caller-supplied email or owner ID chooses the identity. Provider-registry verification is checked by the privileged identity function. Existing UUIDs are unchanged; the singleton-owner constraint and manual binding helper are retired.
- Guided onboarding sets display name, currency and timezone, optionally creating the first account and opening balance atomically. Repeating completed onboarding does not duplicate an account. Settings can edit the display name. Dashboard setup steps and quick actions guide first use.
- Transaction fields show matching categories and same-currency transfer destinations. Form values survive rejected writes, the submit button shows progress, and a request key remains stable for retries until a confirmed success. Ledger posting/reversal remains through existing validated, idempotent SQL functions.
- Bill categories follow the funding account's scope, with explicit selection; linked reserves are filtered to that account.
- Transaction history renders 50 entries per page while search/month/scope and complete report totals remain intact. Monthly journal reads still page through the full selected period for exact financial summaries; this is not a claim of database-level aggregate/report pagination.
- Branded loading/error states, home-screen installation, responsive layout, keyboard skip navigation and reduced-motion support. Android APK delivery is disabled while mobile development is paused.

## Performance boundaries

Authentication/client/base-data memoization is request-scoped React cache only, never a shared financial-data cache. Native JWT retrieval is shared within the requesting backend client. `planning_positions()` replaces one HTTP RPC per account with one owner-filtered batch RPC. Dashboard no longer fetches full goals, commitments, debt and payment-history lists merely to calculate cash positions. Heavy navigation prefetch is disabled. No measured latency or load-capacity claim is made.

## Migrations and validation

Shared additive migration: `202610260012_workspace_experience.sql`. Neon incremental migration: `202610260013_multi_user.sql`. These were tested on the local fixture and in a disposable local Neon-contract database. The full additive transaction was also executed against the real schema with a deliberate rollback before committing it. Production application preserved the existing identity UUID; a repeat run skipped both recorded migrations. Schema cache was refreshed.

Operational helper: `python3 scripts/apply-neon-updates.py --validate` for a deliberate rollback, then omit the flag to commit. Requires securely injected NEON_API_KEY and sqlparse==0.5.5 installed under ignored `.tools/python`. History/checksums prevent silently replaying an already-applied file. Never apply the fresh schema bundle to an existing financial database.

Verified local evidence:

- 48 unit tests passed, including explicit public/private mode and bounded auth-burst behavior.
- 28 existing financial PostgreSQL tests passed.
- Seven reported Neon contract checks passed (six children + parent): migration compatibility, exact posting/reserves, two verified identities and defaults, foreign-record read/write denial, unverified subject rejection and anonymous denial.
- Five production-build Chromium journeys passed: money/report/export/accessibility/mobile, goals/allocations/bills/debts, onboarding/two-user workspace separation, private-mode isolation, and install/download boundary. Transaction browser assertions include error input preservation and retry-key lifecycle.
- Type checking, lint and production build passed. No tests or fabricated financial records were inserted into production.

## Remaining limits

OTP email currently uses the existing Neon email provider. No custom SMTP configuration, MFA enrollment, recovery drill, external backup service or public compliance review is claimed. The application auth burst limiter is bounded **per process**, not a distributed quota across all Vercel instances; it complements provider controls and is not a claim of comprehensive abuse protection. Large-scale signup traffic needs dedicated email delivery and distributed controls.

The public Neon signup/verification flow must still be exercised by real users on the live hostname; local Auth fixtures and emulated native-subject SQL tests do not prove actual email delivery or hosted JWT behavior for every new user. No password, OTP or session token is collected in chat. No paid plan was purchased, no staging environment created and no Android build performed for this release.
