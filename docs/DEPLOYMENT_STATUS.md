# WealthPilot web release — 2026-10-28

Live: https://wealthpilot-sand.vercel.app. Verified public registration is enabled; each user receives a separate private workspace. Android development and downloads are paused at the owner's request. See INSIGHTS.md for the insights phase and WEB_UPGRADE.md for the multi-user architecture; earlier sole-owner plans are historical.

- Vercel: `prj_S96Tc0y5Ann9xvxuNnyQvGnoYgdw`, Node 24, the Insights release adds no schema migration. Deploy committed source with the existing web-only deployment script.
- Neon: `steep-star-32189891`, branch `br-flat-sky-b5iwhifi`, `neondb`, AWS US East 2. Existing endpoint/Auth/Data API retained; no staging project or branch created.
- Both incremental migrations applied transactionally after local tests and a hosted rollback validation. Original identity UUID preserved; repeat application skips recorded versions. No production financial test records inserted.
- Production: PUBLIC_SIGNUP=true / PRIVATE_RELEASE=false. Previews remain private. Signup requires email verification via OTP; provider localhost access remains disabled and the existing production origin trusted.
- Registry is private, anonymous identity provisioning denied and financial RLS retained. Cash-position RPC is owner-filtered. No runtime administrator DB credential or provider management credential is deployed.
- Native owner login/dashboard had been confirmed by the owner previously. New-user isolation and money workflows pass local browser/DB tests. Hosted public UI/provider configuration are verified; new-user real email delivery and complete hosted signup remain for actual user confirmation. Do not equate local emulated auth tests with live JWT validation.

Insights release checks: 59 unit tests, six browser journeys, type checking/lint/format/build passed. The new browser journey checks forecasts, budgets, currency/scope filters, alert opt-out, user isolation and 320/390/650px layouts. The Insights accessibility scan found no issues; desktop/mobile layouts were inspected. The prior multi-user release also passed 28 financial DB and seven reported Neon compatibility checks; the database schema and permissions are unchanged in this phase.

Email remains the Neon shared provider. Auth burst protection is bounded per process, not a distributed app-wide quota. Existing Neon restore history is six hours; custom SMTP, external backups/restore drills, broader load/security work and privacy/deletion/public compliance review remain uncompleted. No paid service upgrade or Play Store release was performed.
