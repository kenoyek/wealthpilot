# Private production release: Vercel + Neon

Selected by the owner: Vercel hosting, Neon instead of Supabase, and access for the sole owner. The owner's address is stored in environment configuration, not committed to this repository.

Status: preparation and local validation. No Vercel deployment or hosted Neon project has been created or verified in this task. No APK or AAB has been built.

## What changed

- Vercel and preview deployments default to private access, even if the private flag is accidentally false. Only the configured, verified owner may access app pages, actions and exports. Public signup is hidden and rejected. Supabase remains only as the existing disposable local regression fixture; hosted Vercel code requires the Neon backend and cannot silently fall back to it.
- Production uses official Neon Auth with its Next.js server integration and Neon Data API's PostgREST-compatible queries/RPCs. `lib/backend/server.ts` isolates provider-specific auth; financial queries and calculations retain their existing behavior.
- Neon identity subjects are mapped to a stable internal UUID in `app_private.identities`. No UUID-format assumption about the provider subject is required. Only one owner can be bound; API roles cannot change the binding. Unbound users cannot obtain an application identity.
- `npm run neon:render` produces an ignored, reviewable `neon/generated.sql` bundle for a **fresh dedicated branch**. It preserves financial migration logic, adapting only `auth.users` foreign keys, the UID accessor and the anonymous role name. It does not overwrite `neon_auth` tables or copy local users/test data. Do not run the fresh-branch bundle against an existing application database; inspect migration history and prepare an incremental plan first.
- `vercel.json` runs `npm run check:production` before the normal build. `.vercelignore` excludes local env files, dependency/build caches and tool binaries. Provider management credentials must never be deployed as app environment variables.

## Required access — currently blocked

The workspace has no authenticated Vercel or Neon management access. Read-only checks to the management APIs were denied by the environment network policy before any credential could be used. The environment draft now declares:

- VERCEL_TOKEN, sent only to api.vercel.com, for project/environment/deployment operations.
- NEON_API_KEY, sent only to console.neon.tech, for the dedicated Neon project and configuration.

Enter values securely in environment settings, never chat or source files. The owner email requirement is already saved with the provided suggested value. Apply the environment changes before retrying the affected operations. Saving a draft does not supply tokens, apply network policy or deploy the app. No Supabase production credential is required.

## Production configuration

Set these on the Vercel production and private preview deployment scopes:

| Variable | Purpose |
| --- | --- |
| WEALTHPILOT_PRIVATE_RELEASE | true for this release |
| WEALTHPILOT_OWNER_EMAIL | the selected sole owner's verified address |
| NEON_AUTH_BASE_URL | Auth URL copied from the selected Neon branch |
| NEON_DATA_API_URL | Data API URL for the same endpoint/database |
| NEON_AUTH_COOKIE_SECRET | an actual cryptographically random secret of at least 32 characters |

Generate and store the cookie secret securely during deployment; a proxy-secret placeholder is not a usable local signing key. Do not set legacy NEXT_PUBLIC_SUPABASE variables on Vercel. No runtime database administrator password or service-role key is needed: the Data API validates the user's Neon JWT.

The preflight checks the documented `*.neon.build` endpoint format. If the selected project uses older/custom URLs, review and test their format before adjusting validation. Configuration validation alone does not verify provider permissions, authentication or hosted financial behavior.

## Release procedure after access is supplied

1. Inspect available Vercel/Neon accounts and projects. Select a dedicated production project/branch; do not assume permission for a paid plan or import local records. Use Node 24 and the supported Next.js runtime on Vercel.
2. Enable Neon Managed Better Auth and Data API on the intended branch. Disable automatic broad public-schema grants: the application's reviewed grants/RLS are authoritative. Expose only the required public API schema, not `app_private`. Restrict signups/invitation access at the provider as well as in the app.
3. Review and apply the generated fresh-branch schema in a staging branch first. Provision the real owner through secure Neon Auth onboarding, verify their address and obtain their actual auth subject. As the privileged database administrator, call `app_private.bind_owner($1)` with that verified subject using a parameterized SQL operation. Never use an email address, guessed UUID or test identity as a substitute. The binding is intentionally not changeable through the app.
4. Set the five deployment variables, configure the exact production origin and `/api/auth` / reset-password callback URLs as required by Neon Auth, and exercise confirmation/recovery. No email or invitation has been sent by this task.
5. Deploy and test an isolated release candidate. Verify owner login, denial of another valid identity, direct Data API/RLS boundaries, exact amounts, transfers/refunds, allocations, bill/debt corrections and CSV reconciliation. Use test records only in the dedicated staging branch. Local browser tests refuse hosted backends and must not be repointed to production to create fixtures.
6. Establish backups/recovery and provider monitoring appropriate for the private release. Record remaining public-launch work: privacy/deletion/legal workflows, comprehensive abuse controls, MFA/reauthentication, load/security assessments and recovery drills. Do not present them as completed.
7. Deploy the reviewed source/configuration to the chosen Vercel production target. Verify its real hostname and record deployment ID, migration versions, checks and rollback procedure. Application rollback does not imply that reversing financial database migrations is safe.

The official SDKs are currently published under beta version identifiers and are pinned. Their older vulnerable Zod 4.x pins were overridden to the patched compatible 4.x version used by the app; the production dependency audit was rerun. Actual hosted Neon Auth/Data API validation is still a release prerequisite.

## Android / APK

Today WealthPilot is a responsive web application. Android packaging is planned for Phase 6 and is separate from publishing the website. It can produce a signed APK for direct installation and an AAB for Google Play.

The existing Next.js SSR/server-action build cannot simply be renamed to an APK or copied into Capacitor's webDir. Mobile work must establish a supported client/server boundary, Android authentication/deep links, secure session storage, navigation/lifecycle handling and device testing. Offline financial entry/synchronization is separate work. Signing/store credentials must remain in secure release tooling; none has been requested or generated here.
