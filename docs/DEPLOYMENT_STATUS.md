# Private Neon release — 2026-10-26

The website is deployed at https://wealthpilot-sand.vercel.app. The real owner email is verified and its provider subject is bound to the application identity. New provider signups are disabled; temporary enrollment is disabled in the final production configuration. No APK/AAB has been built.

## Production resources

- Vercel project: `wealthpilot`, `prj_S96Tc0y5Ann9xvxuNnyQvGnoYgdw`, Node 24.
- Deployment: `dpl_3bmz14zQK1d1yQN8E86Q6nrgwSpY`, READY, production, source commit `1dc51ee`. Initial enrollment release: `dpl_29m5sVzH7CYreJD3UNFBvdf84ivy`.
- Neon project: existing `Wealth Pilot`, `steep-star-32189891`, AWS US East 2.
- Branch/database: existing `production`, `br-flat-sky-b5iwhifi`, `neondb`.
- Native Better Auth and Data API use the same endpoint/database. Broad automatic public-schema grants were disabled; only the reviewed financial grants/RLS are applied.
- All 11 source financial migrations plus the Neon bootstrap were rendered. The full 156-statement bundle successfully executed inside a deliberate rollback validation, then committed to the inspected empty application database. No existing financial records were overwritten; no local test users or data were imported.

## Verified

- Vercel completed the production configuration preflight and build.
- The real HTTPS login responds 200. Dashboard and CSV export redirect unauthenticated requests to login. Auth admin and public signup proxy routes return 403. `nosniff` security header is present.
- Anonymous direct Data API reads/identity RPC requests are rejected for missing authentication.
- All public application tables have RLS. API roles cannot bind the owner. Application account and owner-binding tables were empty after schema deployment.
- A real Chromium mobile browser check passed: the login renders without script errors or horizontal overflow, and enrollment with a non-owner address is rejected before account creation.
- Email verification is required using OTP. Localhost Auth access is disabled. The exact production origin is trusted.
- 41 unit tests, type checking, lint and a local production build passed after adding owner enrollment/verification. Earlier regression evidence remains: 28 local financial DB tests, five local Neon SQL contract checks and three local browser journeys. Those earlier tests do not establish hosted authenticated workflows.

## Owner activation

The owner completed email verification. The provider record was independently checked for the exact configured email and `emailVerified=true`; its actual subject was then bound with a parameterized privileged `app_private.bind_owner` call. A subsequent join confirmed exactly one verified bound owner. No password, OTP, user session token or provider signing key was collected or extracted.

Provider `disable_sign_up=true` is confirmed. Vercel production `WEALTHPILOT_OWNER_SETUP=false` is configured. The final deployment is READY, and the real HTTPS login responds 200 with the setup button absent. General signup/admin routes remain blocked independently of that button.

The final live Chromium mobile check confirmed setup is absent, non-owner sign-in is denied, and no browser errors or horizontal overflow occur. The owner has been asked to sign in on the production site and confirm the dashboard opens. Authenticated hosted financial workflows, recovery and cross-user JWT/RLS tests remain unverified by the agent. Fixture-creating local tests must never target production. No production financial test records were created.

## Recovery and remaining limits

Neon's existing restore history is six hours (21,600 seconds), as read from the project API; no recovery drill or external backup was completed. Do not assume longer retention. Re-deploy a reviewed known-good source/configuration for application rollback; do not blindly reverse ledger migrations. The earlier enrollment deployment must not be used for rollback without keeping provider signup closed and the setup flag false.

Shared Neon OTP email is suitable for this initial private onboarding but has provider limits; custom SMTP is still recommended before wider production use. Public-launch privacy/deletion/legal workflows, full abuse controls, MFA/reauthentication, recovery drills and broader security/load checks remain outstanding. Android packaging is separate Phase 6 work.
