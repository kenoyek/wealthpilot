# Financial calculation rules

## Representation
PostgreSQL NUMERIC is authoritative. JSON carries decimal strings; TypeScript uses a reviewed decimal library for calculations. Never parse monetary strings into JS number for aggregation. Validate ISO currency and amount scale; round half-even at documented currency settlement boundaries. Preserve source amounts, rates and conversion result. Display-only chart values may convert after range checks; chart values cannot feed calculations.

## Balances and recognition
Asset balance = opening debits + posted debits - posted credits. Liability balance = opening credits + credits - debits. Net worth = eligible assets minus liabilities using a disclosed valuation policy. Income and spending use income/expense ledger classes, not movement in bank balances. Transfers, opening equity and goal earmarks are excluded. Cash-basis income recognizes client payment when received, never when invoiced. Project reports distinguish cash margin from uninvoiced work or receivables.

Expense refunds reduce original-category net expense in the refund period and are linked to the source; do not silently rewrite prior closed reports. Full reversals invert every line. Reject an idempotency key reused with a different request payload. Acquire consistent row locks for operations with allocation/balance constraints. Negative account balances are permitted with a warning; reserves and affordability must not treat them as spendable cash.

## Reporting and dates
Store event timestamps in UTC and retain user-entered effective local date and timezone context. Periods are [start,end) in the user's IANA timezone. A later timezone change does not silently redate historical entries. Posted date and creation date are distinct. Custom reports disclose their basis. Preserve stable pagination and an as-of cutoff during exports to avoid drift from concurrent writes.

Keep original-currency totals. Consolidation uses transaction-time locked rates for flow reports and separately labeled as-of rates for balance valuation. Do not rewrite historical flows with current FX. Missing rates produce an explicit incomplete total and currency subtotals; never assume 1:1. Reconcile exported totals to the same report query and precision rules. Cache invalidation follows committed postings and corrections.

## Budgets and affordability
Budget usage = qualifying posted net category expenses in the period and scope. Transfers and debt principal are excluded. Show refund-driven negative spending explicitly. Thresholds fire on crossing, deduplicated per budget/threshold/period and reversible after correction. Phase 1 uses fixed monthly budgets; rollover/envelopes follow later.

Safe-to-spend = max(0, liquid eligible balances - unpaid near-term commitments - protected reserves - other earmarks). Each obligation is subtracted once: a paid bill already reduced cash; a reserve covering that bill cannot also be subtracted. Show a reconciliation of each term. Unknown obligations produce a provisional estimate. Do not include projected freelance invoices or unused credit limits in available cash.

## Planning rules for later phases
Required monthly goal contribution = max(0,target including acquisition costs - funded amount) / remaining scheduled contribution dates, rounded up to the currency unit. Count actual calendar dates, not days/30. Due/past target with a gap reports immediate shortfall rather than division by zero. Property goals include user-entered legal, survey and transaction costs. Goal projections disclose inflation and no-return assumptions; they do not guarantee appreciation.

Emergency coverage = eligible emergency cash / essential monthly spending baseline. Zero or missing baseline is undefined, not infinite coverage. Use an explicitly selected historical period and disclose incompleteness. Conservative irregular-income planning uses a user-approved reliable-income baseline; receivables and optimistic pipeline are scenarios only.

Allocation: satisfy unpaid near-term obligations and reserve deficits before applying user percentages to the remainder. Percentages must sum to 100%; deterministic largest-remainder rounding preserves the exact incoming amount. Funding is virtual and confirmed, never a bank transfer. Existing earmarks and competing goals cannot use the same cash twice.

Subscription monthly equivalents: annual/12, quarterly/3, weekly*52/12; label these planning averages and use actual billing dates for cash forecasts. Recurrence uses calendar arithmetic; Jan 31 clamps to February's last day but retains the original anchor for March. Leap-day policy is explicit. Never infer unused subscriptions from billing records alone.

Debt schedules separate principal, interest, fees and contractual compounding. Snowball/avalanche scenarios use the same total payment assumptions and disclose limits. Multi-currency project margin requires rates and an explicit reporting policy; missing conversion data blocks consolidated margin.

## Required fixtures
0.10+0.20 yields exactly 0.30. Same-currency transfers preserve net worth and income. Duplicate/concurrent requests create one entry. Partial/full refunds reconcile. FX conversion preserves originals and fees. Test zero-decimal currencies, rounding ties, overflow bounds, negative balances, split totals, month-end and leap years, timezone/DST boundaries, stale/missing rates, corrections across periods, missed goal dates, reserve overlap and concurrent allocation. Run property tests for debit/credit balance and conservation. These tests are specified, not executed yet.
