-- A non-null SQL array can still contain null elements; reject them at the API boundary.
alter table public.budgets add constraint warning_levels_nonnull check(array_position(warning_levels,null) is null);
