# Private Neon release preparation — 2026-10-26

Selected target: Vercel + Neon Auth/Data API, sole-owner access. No production deployment, hosted project or Android package has been created by this task.

## Verified locally

- 39 unit tests passed, including fail-closed private access and production configuration checks.
- 28 existing PostgreSQL integration tests passed.
- Five reported Neon SQL compatibility-contract tests passed (four child checks plus parent): all financial migrations apply without Supabase Auth schema; provider subjects map to internal UUIDs; exact postings/reserves work; unbound and anonymous actors are denied. This runs on a separate disposable local database with an emulated JWT-sub accessor, not a live Neon project.
- Three production-build browser journeys passed. Existing money/planning workflows pass through the new shared Data API adapter on the local fixture. Private-release tests permit the verified configured owner, hide signup, and deny another otherwise-valid authenticated user access to records and CSV exports.
- Frozen npm installation, production build, type checking, lint and formatting checks passed. Production dependency audit reports zero known vulnerabilities after replacing the Neon SDKs' vulnerable Zod 4.x pins with the compatible patched root version.

## Remaining deployment prerequisites

Provider management APIs returned network-policy denials; no Vercel/Neon authentication configuration or injected tokens were present. Requirements for VERCEL_TOKEN and NEON_API_KEY, their allowed API destinations and the supplied owner email were saved to the environment draft. Values must be entered securely in settings and the changes applied. No secret values belong in chat, source or application frontend variables.

After access is supplied: inspect/select dedicated projects, provision Neon Auth/Data API, apply reviewed schema, verify/bind the real owner, configure secure server variables/callbacks, and run hosted Auth/RLS/financial smoke checks on staging before releasing. Do not equate the local tests or saved environment draft with a production deployment or hosted authentication validation.

See DEPLOYMENT_PLAN.md for the concrete sequence and Android constraints. The current deliverable remains a responsive web app; APK/AAB packaging is separate mobile work.
