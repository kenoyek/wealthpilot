create or replace view public.goal_values with(security_invoker=true) as select g.id,g.owner_id,g.account_id,g.name,g.kind,g.target::text,g.target_date,g.priority,g.monthly_plan::text,g.essential_monthly::text,g.archived,coalesce(sum(e.amount),0)::text as funded,max(e.effective_date) filter(where e.amount>0) as last_contribution from public.goals g left join public.goal_events e on e.goal_id=g.id group by g.id;
create or replace function public.archive_account(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.goals g join public.goal_events e on e.goal_id=g.id where g.account_id=p_id and g.owner_id=auth.uid() group by g.id having sum(e.amount)>0)
 or exists(select 1 from public.commitments where account_id=p_id and owner_id=auth.uid() and active)
 or exists(select 1 from public.debts d where account_id=p_id and owner_id=auth.uid() and d.principal>(select coalesce(sum(principal),0) from public.debt_payments where debt_id=d.id and undone_entry is null)) then raise exception 'Release reserves, stop active commitments and repay debts before archiving';end if;
 update public.accounts set archived=true where id=p_id and owner_id=auth.uid();if not found then raise exception 'Account unavailable';end if;
end $$;

alter table public.debt_payments add column sequence bigint generated always as identity;
create or replace function public.undo_planning_payment(p_key uuid,p_id uuid,p_kind text,p_date date,p_reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_kind,p_date,p_reason);r uuid;cp public.commitment_payments;dp public.debt_payments;gid uuid;released numeric;
begin
 r:=public.plan_begin(p_key,'undo_payment',req);if r is not null then return r;end if;
 if p_kind='commitment' then
  select * into cp from public.commitment_payments where id=p_id and owner_id=auth.uid() and undone_entry is null;if not found then raise exception 'Payment unavailable';end if;
  if exists(select 1 from public.commitment_payments where commitment_id=cp.commitment_id and undone_entry is null and due_date>cp.due_date) then raise exception 'Undo newer payments first';end if;
  select reserve_goal_id into gid from public.commitments where id=cp.commitment_id;
  r:=public.reverse_entry_internal(cp.entry_id,p_key,p_date,p_reason);released:=cp.released;
  update public.commitment_payments set undone_entry=r where id=cp.id;
  update public.commitments set next_due=cp.due_date,active=true where id=cp.commitment_id;
 elsif p_kind='debt' then
  select * into dp from public.debt_payments where id=p_id and owner_id=auth.uid() and undone_entry is null;if not found then raise exception 'Payment unavailable';end if;
  if exists(select 1 from public.debt_payments x where x.debt_id=dp.debt_id and x.undone_entry is null and x.sequence>dp.sequence) then raise exception 'Undo newer payments first';end if;
  select reserve_goal_id into gid from public.debts where id=dp.debt_id;
  r:=public.reverse_entry_internal(dp.entry_id,p_key,p_date,p_reason);released:=dp.released;
  update public.debt_payments set undone_entry=r where id=dp.id;
  update public.debts set next_due=dp.due_date where id=dp.debt_id;
 else raise exception 'Unsupported payment type';end if;
 if released>0 then insert into public.goal_events(owner_id,goal_id,amount,effective_date,source_entry,reason) values(auth.uid(),gid,released,p_date,r,'Payment undo restored reserve');end if;
 perform public.plan_finish(p_key,'undo_payment',req,r);return r;
end $$;
