alter table public.budgets add column warning_levels integer[] not null default array[50,75,90,100],add column alerts_enabled boolean not null default true;
alter table public.budgets add constraint valid_warning_levels check(cardinality(warning_levels)<=10 and 0<all(warning_levels) and 100>=all(warning_levels));
create or replace view public.budget_values with(security_invoker=true) as select b.id,b.owner_id,b.category_id,b.month,b.currency,b.amount::text as amount,b.threshold,b.warning_levels,b.alerts_enabled from public.budgets b;
