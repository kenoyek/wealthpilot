> Current web release: verified multi-user registration and Android pause are documented in [WEB_UPGRADE.md](WEB_UPGRADE.md). The sole-owner/Supabase proposal below is historical where it conflicts.

# Proposed architecture

## Boundaries
Use Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Lucide, React Hook Form and Zod. Recharts presents rounded display values only. Use TanStack Query only where interactive client caching is justified. Choose exact supported versions and commit a lockfile at approved implementation time; none is invented or installed during discovery.

Supabase provides PostgreSQL, Auth and private Storage. Use the current supported SSR session integration. Server-rendered pages and route handlers use the requesting user's session; database RLS remains authoritative. Privileged credentials are isolated to narrowly scoped operational jobs. No service-role fallback for normal user requests. Browser Supabase access is allowed only for explicitly reviewed RLS-protected operations.

## Financial write path
Validated request -> authenticated route/RPC -> owner and related-record checks -> idempotency reservation -> atomic ledger posting -> audit event -> commit. The SQL function is the only allowed posted-ledger mutation interface. Prefer invoker security; any definer function requires fixed search_path, explicit auth.uid ownership checks, restricted EXECUTE grants and dedicated authorization tests. API responses expose decimal strings. Never accept a client-computed balance as authoritative.

Read models aggregate posted entries in SQL with NUMERIC and share query functions across dashboard, reports and exports. Compute consolidated currency views from explicit historical rates. Keep account balances derived initially; add cache tables only when reconciliation and invalidation have been tested. SQL constraints protect invariants under concurrent access.

## Proposed repository layout after approval
app/ for routes and screens; components/ for reusable UI; features/{accounts,transactions,budgets,reports,onboarding}/ for domain views; lib/{auth,db,money,validation}/ for shared boundaries; supabase/migrations/ and supabase/tests/ for schema and authorization; tests/{unit,integration,e2e}/; docs/ for approved design. No worktree is needed: each cloud task already has an isolated checkout.

## Runtime and environments
Use Node 24 LTS with npm and frozen npm ci installs once a lockfile exists. Local Supabase is the preferred integration-test backend if a working Docker daemon is available; otherwise use a dedicated development Supabase project, never production. Independently provision staging and production. No secrets are required for Phase 0. Later, browser configuration needs SUPABASE_URL and a publishable key with RLS enabled; server-only administrative credentials are restricted to jobs that need them and never prefixed NEXT_PUBLIC_. Provider configuration names will follow selected SDK conventions at implementation time.

Start with a supported Node hosting runtime for Next.js, subject to approval. Cloudflare Workers through a maintained Next.js adapter is an alternative requiring compatibility and deployment smoke tests before commitment. Do not assume a static Pages export supports authentication, server routes or SSR. Managed cron calls a protected, idempotent job endpoint for reminders in later phases. Use a transactional outbox when notifications are introduced; never send mail within the ledger transaction.

## Validation and delivery
Vitest tests money and calendar rules; React Testing Library tests interactions; real Postgres tests exercise atomicity, RLS, constraints and concurrency; Playwright tests signup/onboarding/manual entries/transfer/refund/export. CI runs frozen install, lint, typecheck, unit tests, migrations on a clean database, integration/security tests and production build. Browser smoke tests run against that build. No test success is claimed during Phase 0.

## Operations and risks
Observe request IDs, latency, failures and job lag without financial payloads or tokens. Use explicit timeouts and request limits. Private uploads require ownership-scoped signed URLs and content validation. Test backup restoration and database migration rollback/recovery plans before launch. Supabase region, hosting adapter, email delivery and production recovery remain external decisions. Future billing does not grant support staff access to financial rows.
