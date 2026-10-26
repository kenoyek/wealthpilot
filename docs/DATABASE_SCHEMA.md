# Database design

Proposed PostgreSQL schema; not executable migrations. UUID identifiers, timestamptz audit times, explicit effective date, and owner_id referencing auth.users are defaults. Monetary quantities use NUMERIC(28,8); rates use NUMERIC(30,12). Reject scale beyond each currency's configured minor units on posted user amounts; rate conversion rounds explicitly. Reject NaN, infinities and nonpositive rates. Bounds and currency metadata are tested. Do not use SQL money or float types.

## Core entities
| Table | Important columns and constraints |
| --- | --- |
| profiles | user_id PK, display_name; no public directory |
| user_preferences | user_id PK, reporting_currency, IANA timezone, country, budgeting method |
| currencies | code PK, minor_units, enabled; controlled reference data |
| ledger_accounts | id, owner_id, kind(asset/liability/income/expense/equity), currency, name, scope, archived_at |
| financial_accounts | id, owner_id, ledger_account_id UNIQUE, account_type, institution label; only asset/liability ledger accounts |
| transaction_categories | id, owner_id, scope, parent_id, ledger_account_id; editable templates copied on opt-in |
| journal_entries | id, owner_id, kind, effective_at, local_date, description, idempotency_key, request_hash, reversal_of, correction_group, created_at |
| journal_lines | id, owner_id, entry_id, ledger_account_id, debit, credit, currency, category_id; exactly one positive side |
| transaction_metadata | entry_id PK, owner_id, merchant, notes; no mutable financial totals |
| transaction_tags / entry_tags | owner-scoped tags and composite-owned links |
| budgets | id, owner_id, category_id, scope, currency, start_date, end_date, amount, thresholds; prevent ambiguous overlapping active category budgets |
| exchange_rates | id, owner_id, base_currency, quote_currency, rate, source, observed_at, rate_type; immutable when referenced |
| entry_conversions | id, owner_id, entry_id, rate_id, source_amount, converted_amount, reporting_currency, rounding_policy |
| audit_logs | id, owner_id, actor_id, action, entity_id, request_id, created_at, minimal redacted change metadata; append-only |
| idempotency_requests | owner_id, operation, key UNIQUE, request_hash, result_entry_id; scoped retry ledger |

Accounts and every related row expose UNIQUE(owner_id,id), with composite foreign keys (owner_id, related_id) preventing cross-user and cross-scope references. Entry creation and all lines commit in one database transaction. Deferred constraint triggers verify balancing per entry and currency, minimum two lines, currency/account agreement and required clearing legs for FX. Direct client INSERT/UPDATE/DELETE on posted entries/lines is revoked; posting functions enforce invariants. Corrections create new entries, never edit or delete posted lines. Description/tag changes have explicit audited metadata operations.

## Ledger examples
NGN income: debit bank asset 500000, credit earned-income 500000. Expense: debit grocery expense 30000, credit bank 30000. Same-currency transfer: debit destination asset, credit source asset; no income/expense line. Opening asset balance: debit asset, credit opening equity. Refund: debit bank, credit original expense category, linked to the purchase. Liability payments split principal and interest, never classify all repayment as expense.

FX transfer uses balanced currency clearing accounts: credit USD source/debit USD clearing; debit NGN destination/credit NGN clearing. Preserve both actual amounts, explicit rate and separately posted fees. Do not add nominal USD and NGN debits together. Functional-currency valuation and realized FX reporting are distinct derived calculations. Formal business accounting/tax statements are outside the MVP.

## Later tables
Phase 2: savings_goals(target amount/currency/date/priority), goal_contributions, reserve_allocations, allocation_templates, bills, recurring_templates, subscriptions, subscription_price_history, debts and debt_payments. Goal contributions earmark assets; they are not new assets. Link actual payments to ledger entries. Enforce sum of active earmarks <= eligible balance under a lock; users may override planning targets, not overallocate the same cash silently.

Phase 3: clients, projects, milestones, invoices, invoice_items, invoice_payments and project_expense_links. Unpaid invoices are receivables in separate reporting; cash-basis dashboard recognizes only posted receipts. Payment allocations cannot exceed invoice balance without an explicit credit workflow.

Later: household_assets, maintenance_records, forecasts, forecast_assumptions, notifications, outbox_jobs, import_batches, import_rows, attachments, financial_insights, entitlements and deletion_jobs. Use immutable import fingerprints scoped by owner/provider/account and allow reviewed duplicate overrides. Attachments live in a private bucket keyed by owner and opaque ID.

## Access, indexes and lifecycle
Enable RLS on every owner table and storage objects. SELECT uses owner_id=auth.uid(); INSERT/UPDATE require both USING and WITH CHECK where applicable. No anonymous financial access. Index (owner_id,effective_at,id), owner/account/currency, budget periods, FK columns and idempotency keys. Use keyset pagination and bounded export jobs. Global reference tables have read-only access. Audit retention and user erasure must be reconciled through documented retention policy; append-only means no routine user edits, not indefinite retention against a lawful deletion request.

Migrations are versioned, reviewed and tested from empty database and prior release. Backfills use explicit bounds and reconciliation. No production migrations are executed in onboarding.
