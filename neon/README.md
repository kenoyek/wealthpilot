# Neon production schema

Run `npm run neon:render` to produce `neon/generated.sql` for review. This is a fresh-branch transaction, not an incremental migration command and not an automatic production deployment. Apply it only to a dedicated reviewed Neon branch with Managed Better Auth and Data API enabled. Turn off broad automatic public-schema grants and retain the explicit application grants/RLS.

The renderer uses the existing financial SQL as source and maps:

- `auth.users` foreign keys to `app_private.identities`;
- `auth.uid()` to `app_private.current_user_id()`;
- Supabase's `anon` role name to Neon's `anonymous` role.

The native `auth.user_id()` accessor supplies the verified Neon JWT subject. A privileged administrator binds the real verified owner using parameterized `SELECT app_private.bind_owner($1)`. The internal UUID is generated independently of the provider's subject format. The binding helper is not executable by API roles, and changing a populated owner binding is a separate reviewed operation. The runtime `ensure_application_user` RPC returns only the bound caller's internal UUID. No `neon_auth` records are rewritten.

`npm run test:neon-contract` creates a separate disposable database inside the local fixture's PostgreSQL container, applies every rendered migration, exercises accounting/ownership and drops only that temporary database. It emulates the JWT-sub accessor; it does **not** validate a live Neon issuer, Auth service, cookie flow or Data API deployment. Production schema and Auth checks must run on the actual selected hosted project after access is supplied.
