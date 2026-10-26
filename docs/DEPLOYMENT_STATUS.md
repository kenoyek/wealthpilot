# Private Neon release preparation — 2026-10-26

Selected target: Vercel + Neon Auth/Data API, sole-owner access. The Vercel project is created, but no deployment or Android package has been built. The existing Neon project was inspected without changing its data or Auth settings.

## Verified locally

- 40 unit tests passed, including fail-closed private access and production configuration checks.
- 28 existing PostgreSQL integration tests passed.
- Five reported Neon SQL compatibility-contract tests passed (four child checks plus parent): all financial migrations apply without Supabase Auth schema; provider subjects map to internal UUIDs; exact postings/reserves work; unbound and anonymous actors are denied. This runs on a separate disposable local database with an emulated JWT-sub accessor, not a live Neon project.
- Three production-build browser journeys passed. Existing money/planning workflows pass through the new shared Data API adapter on the local fixture. Private-release tests permit the verified configured owner, hide signup, and deny another otherwise-valid authenticated user access to records and CSV exports.
- Frozen npm installation, production build, type checking, lint and formatting checks passed. Production dependency audit reports zero known vulnerabilities after replacing the Neon SDKs' vulnerable Zod 4.x pins with the compatible patched root version.

## Remaining deployment prerequisites

Management credentials now work. The existing Neon project "Wealth Pilot" (`steep-star-32189891`, production branch `br-flat-sky-b5iwhifi`) has Managed Better Auth enabled for `neondb`, but no Data API. The existing database schema/data have not yet been inspected because runtime egress policy blocks its exact host. No schema migration, identity binding, signup or Auth configuration change was performed.

Created Vercel project `wealthpilot` (`prj_S96Tc0y5Ann9xvxuNnyQvGnoYgdw`) using Node 24. The reserved domain is `wealthpilot-sand.vercel.app`; it is not a verified running app. Configured private-release mode, the selected owner email and an encrypted, randomly generated cookie-signing secret for production and previews. Management credentials were not copied into app variables. Neon runtime URLs remain unset until the Data API is provisioned and validated.

The production preflight now accepts matching Neon-managed `.neon.tech` endpoints in addition to `.neon.build`, while rejecting custom/lookalike hosts. Unit tests, lint and type checking passed after this adjustment.

The environment draft adds exact selected Neon SQL/Auth/Data API hosts, official documentation/API-spec hosts and the reserved Vercel hostname to the existing allowlist. Review/save and publish environment settings to activate that network change, then retry the blocked read-only checks. Saving the draft alone does not activate egress or deploy the app.

Next: inspect existing schemas and real owner state; select an isolated staging branch; enable Data API with automatic broad grants disabled; apply reviewed schema only where safe; verify/bind the actual owner; configure trusted origins and production auth settings; then test hosted authentication/RLS/financial behavior before deploying production. Never guess or mark an unverified owner as verified, and never run local fixture tests against production.

See DEPLOYMENT_PLAN.md for the concrete sequence and Android constraints. The current deliverable remains a responsive web app; APK/AAB packaging is separate mobile work.
