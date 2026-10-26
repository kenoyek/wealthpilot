> Current web release: verified multi-user registration and Android pause are documented in [WEB_UPGRADE.md](WEB_UPGRADE.md). The sole-owner/Supabase proposal below is historical where it conflicts.

# Security model

## Threats and boundaries
Protect financial records, personal metadata, exports, attachments and authentication sessions. Consider malicious users guessing IDs, forged owner IDs, stale sessions, compromised browsers, CSV formulas, oversized imports, privileged job misuse and prompt injection through financial notes. Database RLS is the final user-isolation boundary; UI filtering is not authorization.

Every read/write resolves authenticated identity server-side. Composite ownership foreign keys reject mixed-owner associations. Test SELECT/INSERT/UPDATE/DELETE and RPC calls as two users, anonymous and expired sessions; cover malicious owner changes, joins, exports and signed storage URLs. Use separate service-role operational tests so bypass-RLS credentials never hide broken policies.

## Authentication and application controls
Use Supabase Auth with verified email and supported recovery. Optional MFA and sensitive-action reauthentication precede public launch. Use secure cookie/session practices from current SDK documentation, protect state-changing routes against CSRF, avoid unsafe redirects and enforce authorization on every server action. Validate inputs with Zod plus database constraints. Set CSP and security headers compatible with the chosen deployment. Rate-limit authentication, writes, exports and AI separately; apply payload/time bounds. Use parameterized SQL and safe rendering of merchant/notes fields.

## Files, imports and exports
Private buckets, ownership checks, short-lived signed URLs, MIME/content and size checks, opaque filenames, safe download headers, and malware scanning where justified. No public financial attachment URLs. Imports later use staged validation, bounded rows, preview, idempotent commit and an error report; reject executable formulas and malformed encodings. CSV export escapes spreadsheet formula prefixes in text fields while preserving typed numeric fields safely. Export jobs are owner-scoped and expire outputs.

## Privilege and secrets
Publishable browser keys require RLS and are not authorization secrets. Service-role/database credentials never enter browser bundles or normal user request paths. Reuse cloud-injected bindings where supported; inspect only presence, not secret values. Choose raw server-secret delivery versus proxy credentials according to the actual protocol; proxy placeholders cannot authenticate arbitrary local database clients. No financial payloads, session tokens, keys or attachment bodies in logs. Restrict operational credentials and rotate on exposure.

## Jobs and future AI
Jobs authenticate explicitly and operate on bounded authorized tasks with audit records, retries and deduplication. Admin/support interfaces have no general financial browsing capability. Future collaboration requires explicit grants and additional RLS tests before release. AI is opt-in, receives minimized authorized data, and uses deterministic calculation outputs. Treat imported text as data, restrict tools, disclose uncertainty and prohibit payment execution. No financial-record mutation without an explicit reviewed confirmation path.

## Privacy and recovery
Define regional hosting, vendor agreements, retention windows, export/deletion workflow and applicable Nigerian and other privacy obligations with legal review. Do not claim compliance. Erasure revokes sessions, removes private objects and user-linked data through an audited job; disclose backup retention delays. Backups are encrypted with restricted access; define and approve recovery objectives before launch, and test restore/reconciliation. Financial audit history is immutable to routine user operations, with a separate authorized retention/deletion process.

## Release gates
Pass cross-user and anonymous adversarial tests, ledger concurrency checks, storage URL isolation, session recovery tests and dependency scanning. Review definer functions and service-role uses individually. Test backup restoration and incident response before public release. Phase 0 contains design only: no security controls have yet been implemented or verified.
