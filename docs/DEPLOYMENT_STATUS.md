# Private Neon release — 2026-10-26

The website is deployed at https://wealthpilot-sand.vercel.app. Owner enrollment and email verification are available; financial access remains locked until the real verified owner is bound. No APK/AAB has been built.

## Production resources

- Vercel project: `wealthpilot`, `prj_S96Tc0y5Ann9xvxuNnyQvGnoYgdw`, Node 24.
- Deployment: `dpl_29m5sVzH7CYreJD3UNFBvdf84ivy`, READY, production, source commit `5c0d2e4`.
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

## Owner activation still required

The owner must open the production login page, enter their configured email and chosen password, choose **Set up owner account**, and enter the emailed six-digit code under **Verify email**. Passwords and codes belong only on the HTTPS site, never chat.

The temporary `WEALTHPILOT_OWNER_SETUP=true` permits the app's server action to enroll only the configured owner address. General signup through the app's Auth proxy remains blocked, and unbound identities cannot access financial data. Provider signup is temporarily enabled so this first account can be created; after verification, disable it with the provider management API and disable the app setup flag, then deploy the final locked configuration.

Before owner binding, query the actual provider account by the exact configured email and require `emailVerified=true`. Use its real subject in a parameterized privileged `app_private.bind_owner` call. Never invent a subject, use the email as the subject, or mark an unverified account verified. No owner identity had been bound at the time of this deployment.

Authenticated hosted login/session, financial workflows, recovery and cross-user JWT/RLS checks remain unverified until the owner completes enrollment. Fixture-creating local tests must never target production. No production financial test records were created.

## Recovery and remaining limits

Neon's existing restore history is six hours (21,600 seconds), as read from the project API; no recovery drill or external backup was completed. Do not assume longer retention. Re-deploy a reviewed known-good source/configuration for application rollback; do not blindly reverse ledger migrations. The initial application deployment has no earlier production version to roll back to.

Shared Neon OTP email is suitable for this initial private onboarding but has provider limits; custom SMTP is still recommended before wider production use. Public-launch privacy/deletion/legal workflows, full abuse controls, MFA/reauthentication, recovery drills and broader security/load checks remain outstanding. Android packaging is separate Phase 6 work.
