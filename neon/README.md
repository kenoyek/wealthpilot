# Neon schema and incremental updates

Production uses Native Neon Auth and the Data API. Every verified provider subject maps to its own internal UUID in the protected `app_private.identities` registry. `ensure_application_user()` takes no owner/email parameter: it checks the native JWT subject against the provider's verified user registry, provisions the requesting identity idempotently, and initializes only that workspace. All original financial owner filters/RLS/composite foreign keys remain.

`npm run neon:render` produces ignored `neon/generated.sql` for a **fresh database only**, combining the historical financial migrations and reviewed Neon increments. It maps auth.users/auth.uid()/anon to the Neon identity bridge. The historical bootstrap's singleton constraint is removed by the multi-user increment; manual owner binding is retired. Do not execute this fresh bundle against the existing production database.

For the existing deployment use `scripts/apply-neon-updates.py`: it applies only reviewed new additive files transactionally, records hashes/versions and verifies existing identity UUID preservation. `--validate` deliberately rolls the whole transaction back. Read docs/WEB_UPGRADE.md for exact prerequisites and evidence. It does not create a staging environment or copy local accounts into production.

`npm run test:neon-contract` uses a separate disposable local database. It emulates native JWT-sub and provider-user verification, applies all schema files, and tests multi-user initialization, isolation, exact balances, reserves and rejection of anonymous/unverified actors. This does not validate a real hosted issuer or send email.
