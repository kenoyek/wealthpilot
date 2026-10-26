# WealthPilot

A private personal finance workspace for people whose income does not fit one monthly payslip. Built with Next.js and strict TypeScript. The selected private production backend is Neon Auth + Neon Data API; the existing Supabase stack remains only as a disposable local regression fixture. See [production deployment](docs/DEPLOYMENT_PLAN.md).

## Local development

Prerequisites: Node 24, npm, Python 3, curl, tar and a working Docker daemon. Each cloud task already provides an isolated checkout; no worktree is required.

```sh
npm ci
npm run tools:install
npm run db:start
npm run env:local
npm run dev
```

The tool installer downloads the pinned Supabase CLI 2.75.0 from its official release and checks its SHA-256 against the official checksum manifest. The retained binary lives in ignored `.tools/`. The npm CLI's newer home-directory requirements were incompatible with this cloud sandbox, so the verified standalone binary is used. The wrapper selects the CLI-supported Docker Hub mirror because public.ecr.aws is blocked in this environment. TLS and image digest verification remain enabled. On cloud machines using Docker vfs, the normal multi-layer database image exhausts disk space; `db:start` exports the official image by immutable digest and imports its flattened filesystem, preserving and verifying its runtime configuration. The checksum-verified crane tool is retained in `.tools/`. Normal overlay-based Docker installations use the original image directly. Unneeded realtime, storage, studio and analytics services are excluded from this MVP backend.

`db:start` applies migrations on a fresh local database. After updating this checkout, run `node scripts/supabase.mjs migration up` to apply pending additive migrations to an existing local database before starting the application. `npm run db:reset` **destroys local development data**; use it only with a disposable database. Do not reset a populated environment merely to restart development.

`env:local` writes only local API bindings to ignored `.env.local`, refuses to overwrite existing configuration, and prints no keys. Use `npm run env:local -- --replace` only when intentionally replacing a disposable local configuration. Never commit credentials. Keep the local Supabase stack private; its development credentials are not production credentials. Local signup is immediately confirmed to support tests. Production must enable email confirmation and use a configured mail provider.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:e2e
```

`test:db` refuses non-loopback targets and creates independent test users. It exercises decimal postings, refunds, transfer neutrality, immutable corrections, retries/concurrency and cross-user access. Browser tests create a separate test user, record an expense, reconcile the account/report, download CSV and verify mobile layout/sign-out. For Playwright, install Chromium with `npx playwright install chromium`, or use an existing compatible executable through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. The cloud image includes Chromium; its browser CDN is blocked. Tests add labeled fixtures only to the disposable local backend, never production.

For a production build locally: `npm run build`, then `npm start`. Production browser tests run on port 3001 and own that server, independently of development on port 3000. Stop the app with its process signal; stop the backend with `node scripts/supabase.mjs stop`. Processes do not survive environment snapshots and must be restarted.

## Current tracking and planning behavior

- Sign-up/sign-in, recovery confirmation route and password updates.
- Currency/timezone preferences with optional financial onboarding.
- Positive opening balances, asset accounts, archive without losing history.
- Editable income/expense category names and personal/business scope.
- Manual income, expenses, same-currency transfers and linked partial/full refunds.
- Append-only ledger, reasoned reversals and separate replacement entry workflow.
- Fixed monthly category budgets with configurable visual warning threshold.
- Authenticated dashboard, month/scope/search filters, currency-separated reports and CSV exports.
- Empty real-user states; no fabricated records, bank connections or live fund movements.
- Cash-backed savings/emergency reserves and goal contribution planning.
- Received-income allocation with saved percentage templates, preview/confirmation and undo.
- Recurring bills/subscriptions, actual-payment recording, price history and in-app reminders.
- Debt principal/interest separation, repayment comparisons and audit-preserving corrections.

Financial values cross JSON boundaries as strings; PostgreSQL NUMERIC and Decimal.js do the arithmetic. Signed ledger lines balance to zero per entry; transfers have asset lines only. Direct API ledger mutations are revoked. RPCs check current ownership and use transaction locks for safe idempotency/refund limits. RLS and composite foreign keys protect user boundaries. Dashboard and reports use the same ledger calculations.

## Explicit limits before public use

This is a development MVP, not a public-launch approval or compliance claim. Bank/wallet accounts remain asset accounts with zero/positive opening balances; the separate debt register records liability principal and repayments. Transfers across currencies are rejected instead of inventing a rate. Multi-currency totals remain separate. Effective dates are local calendar dates preserved on later timezone changes; a separate event-time entry interface is not implemented. Correction reversal and replacement are two deliberate user actions, not an atomic replacement wizard.

Phase 2 adds cash-backed goals/reserves, a recorded-commitment cash plan, received-income allocation, recurring bills/subscriptions, debts and in-app reminders. Imports, projects/invoices, advanced forecasts and AI remain later phases. See [Phase 2 implementation status](docs/PHASE_2_STATUS.md) for behavior, assumptions and controls. Budgets provide visual warnings, not email/push notifications. Category classification cannot be changed after creation through the API; names can be renamed. Accounts are archived; category deletion and merging have no UI. No attachments are accepted, so no storage buckets are provisioned. MFA, sensitive-action reauthentication, distributed application rate limiting, data deletion jobs, retention/legal review, backup restore drills and production monitoring remain public-release gates. Supabase Auth supplies its own rate limits, but these are not comprehensive app-wide quotas.

For hosted use, follow [the Vercel + Neon deployment plan](docs/DEPLOYMENT_PLAN.md). Use the same Neon branch for managed Auth and Data API, provision its verified owner binding, and keep server cookie secrets in secure Vercel settings. No Supabase production project is used. Hosted login/recovery, database identity mapping and Data API/RLS must be verified before release. The local regression fixture is not a production database.

Additional checks: `npm run test:neon-contract` for the isolated SQL adapter contract, `npm run neon:render` to prepare the fresh-branch schema for review, and `npm run check:production` inside the configured Vercel build. A failed production preflight on a local fixture is intentional. Browser fixture tests now also cover private-owner access on port 3002 and refuse hosted backend variables.

Planning starts at `/planning`; cash-backed contributions are virtual earmarks, not transfers. Bill/debt payments require explicit confirmation of payments already made. Reports separate debt-principal cash movement from expenses.

Architecture and roadmap are in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The original Phase 0 proposals are retained as the architecture baseline; this README documents actual implemented limits.

Next.js uses its supported TypeScript compiler API mode because its detached CLI checker returned empty output in this sandbox. Type checking remains enabled during builds and as a separate command.

Android private builds and signing are documented in [android/README.md](android/README.md). Use `npm run android:tools`, `npm run android:sdk` and `npm run android:build` for a local test APK. The mobile status is in [docs/ANDROID_STATUS.md](docs/ANDROID_STATUS.md). Web home-screen installation instructions are available at `/install`.

## Multi-user web release

See [docs/WEB_UPGRADE.md](docs/WEB_UPGRADE.md) for the current public-registration architecture, UX/performance changes, migration evidence and remaining operational limits. Production opens verified registration only with both `WEALTHPILOT_PUBLIC_SIGNUP=true` and `WEALTHPILOT_PRIVATE_RELEASE=false`; previews remain private. New verified users receive isolated workspaces automatically. Run `python3 scripts/deploy-vercel.py --web-only` for web deployment with Android downloads paused. No APK rebuild is required.
