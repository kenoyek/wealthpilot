alter table public.debts add column voided boolean not null default false;
create or replace view public.debt_values with(security_invoker=true) as select d.id,d.owner_id,d.name,d.account_id,d.principal::text,d.minimum::text,d.apr::text,d.next_due,d.anchor_day,d.reserve_goal_id,(case when d.voided then 0 else d.principal-coalesce(sum(p.principal),0) end)::text as remaining,d.voided from public.debts d left join public.debt_payments p on p.debt_id=d.id and p.undone_entry is null group by d.id;
create or replace function public.planning_position(p_account uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.accounts;cash numeric;reserved numeric;uncovered numeric:=0;total_due numeric:=0;due numeric;paid numeric;remaining numeric;d date;h date:=public.plan_today()+30;c record;pair record;cover jsonb:='{}';key text;
begin
 select * into a from public.accounts where id=p_account and owner_id=auth.uid();if not found then raise exception 'Account unavailable';end if;
 select coalesce(sum(amount),0) into cash from public.lines where account_id=a.id and owner_id=auth.uid();
 select coalesce(sum(e.amount),0) into reserved from public.goal_events e join public.goals g on g.id=e.goal_id where g.account_id=a.id and g.owner_id=auth.uid();
 for c in select next_due,cadence,anchor_day,amount,reserve_goal_id from public.commitments where owner_id=auth.uid() and account_id=a.id and active and next_due is not null loop
  due:=0;d:=c.next_due;
  while d is not null and d<=h loop due:=due+c.amount;d:=public.next_cycle(d,c.cadence,c.anchor_day);end loop;
  total_due:=total_due+due;
  if c.reserve_goal_id is null then uncovered:=uncovered+due;else key:=c.reserve_goal_id::text;cover:=jsonb_set(cover,array[key],to_jsonb((coalesce((cover->>key)::numeric,0)+due)::text));end if;
 end loop;
 for c in select * from public.debts where owner_id=auth.uid() and account_id=a.id and not voided loop
  select c.principal-coalesce(sum(principal),0) into remaining from public.debt_payments where debt_id=c.id and undone_entry is null;
  if remaining<=0 then continue;end if;
  select coalesce(sum(principal+interest),0) into paid from public.debt_payments where debt_id=c.id and due_date=c.next_due and undone_entry is null;
  due:=0;d:=c.next_due;
  while d<=h loop due:=due+greatest(0,least(c.minimum,remaining)-paid);paid:=0;d:=public.next_cycle(d,'monthly',c.anchor_day);end loop;
  total_due:=total_due+due;
  if c.reserve_goal_id is null then uncovered:=uncovered+due;else key:=c.reserve_goal_id::text;cover:=jsonb_set(cover,array[key],to_jsonb((coalesce((cover->>key)::numeric,0)+due)::text));end if;
 end loop;
 for pair in select * from jsonb_each_text(cover) loop uncovered:=uncovered+greatest(0,pair.value::numeric-public.goal_funded(pair.key::uuid));end loop;
 return jsonb_build_object('cash',cash::text,'reserved',reserved::text,'due',total_due::text,'uncovered',uncovered::text,'room',(cash-reserved-uncovered)::text,'safe',greatest(0,cash-reserved-uncovered)::text,'currency',a.currency,'through',h::text);
end $$;

create or replace function public.pay_debt(p_key uuid,p_id uuid,p_principal text,p_interest text,p_category uuid,p_date date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_principal,p_interest,p_category,p_date);r uuid;d public.debts;a public.accounts;v numeric;i numeric;remaining numeric;paid numeric;eid uuid;released numeric:=0;nextdue date;
begin
 r:=public.plan_begin(p_key,'pay_debt',req);if r is not null then return r;end if;
 select * into d from public.debts where id=p_id and owner_id=auth.uid() and not voided;if not found then raise exception 'Debt unavailable';end if;
 select * into a from public.accounts where id=d.account_id and not archived;if not found then raise exception 'Account unavailable';end if;
 v:=public.plan_money(p_principal,a.currency,true);i:=public.plan_money(p_interest,a.currency,true);
 if v+i=0 or p_date is null or p_date<'1900-01-01' or p_date>'9998-12-31' then raise exception 'Enter an actual payment and valid date';end if;
 select d.principal-coalesce(sum(principal),0) into remaining from public.debt_payments where debt_id=d.id and undone_entry is null;
 if v>remaining or remaining<=0 then raise exception 'Principal exceeds outstanding debt';end if;
 if i>0 and not exists(select 1 from public.categories where id=p_category and owner_id=auth.uid() and kind='expense' and scope=a.scope) then raise exception 'Interest requires a matching expense category';end if;
 insert into public.entries(owner_id,kind,effective_date,description,scope,currency,category_id,idempotency_key,request) values(auth.uid(),'debt_payment',p_date,'Debt payment: '||d.name,a.scope,a.currency,case when i>0 then p_category end,p_key,req) returning id into eid;
 insert into public.lines(owner_id,entry_id,account_id,bucket,amount) values(auth.uid(),eid,a.id,'asset',-(v+i));
 if v>0 then insert into public.lines(owner_id,entry_id,bucket,amount) values(auth.uid(),eid,'liability',v);end if;
 if i>0 then insert into public.lines(owner_id,entry_id,bucket,amount) values(auth.uid(),eid,'expense',i);end if;
 insert into public.audit_logs(owner_id,entry_id,action) values(auth.uid(),eid,'posted');
 if d.reserve_goal_id is not null then released:=least(v+i,public.goal_funded(d.reserve_goal_id));if released>0 then insert into public.goal_events(owner_id,goal_id,amount,effective_date,source_entry,reason) values(auth.uid(),d.reserve_goal_id,-released,p_date,eid,'Debt reserve consumed');end if;end if;
 select coalesce(sum(principal+interest),0) into paid from public.debt_payments where debt_id=d.id and due_date=d.next_due and undone_entry is null;
 nextdue:=case when paid+v+i>=least(d.minimum,remaining) then public.next_cycle(d.next_due,'monthly',d.anchor_day) else d.next_due end;
 r:=gen_random_uuid();insert into public.debt_payments(id,owner_id,debt_id,entry_id,principal,interest,due_date,next_due_after,released) values(r,auth.uid(),d.id,eid,v,i,d.next_due,nextdue,released);
 update public.debts set next_due=nextdue where id=d.id;
 perform public.plan_finish(p_key,'pay_debt',req,r);return r;
end $$;
create or replace function public.archive_account(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.goals g join public.goal_events e on e.goal_id=g.id where g.account_id=p_id and g.owner_id=auth.uid() group by g.id having sum(e.amount)>0)
 or exists(select 1 from public.commitments where account_id=p_id and owner_id=auth.uid() and active)
 or exists(select 1 from public.debts d where account_id=p_id and owner_id=auth.uid() and not d.voided and d.principal>(select coalesce(sum(principal),0) from public.debt_payments where debt_id=d.id and undone_entry is null)) then raise exception 'Release reserves, stop active commitments and repay debts before archiving';end if;
 update public.accounts set archived=true where id=p_id and owner_id=auth.uid();if not found then raise exception 'Account unavailable';end if;
end $$;


create function public.void_debt(p_key uuid,p_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_reason);r uuid;eid uuid;
begin
 r:=public.plan_begin(p_key,'void_debt',req);if r is not null then return r;end if;
 if not exists(select 1 from public.debts where id=p_id and owner_id=auth.uid() and not voided) then raise exception 'Debt unavailable';end if;
 if exists(select 1 from public.debt_payments where debt_id=p_id and undone_entry is null) then raise exception 'Undo existing debt payments before voiding an opening';end if;
 select e.id into eid from public.entries e join public.planning_requests q on q.key=e.idempotency_key and q.owner_id=e.owner_id where q.owner_id=auth.uid() and q.operation='create_debt' and q.result_id=p_id and e.kind='debt_opening';
 if eid is null then raise exception 'Opening entry unavailable';end if;
 r:=public.reverse_entry_internal(eid,p_key,public.plan_today(),p_reason);
 update public.debts set voided=true where id=p_id;
 perform public.plan_finish(p_key,'void_debt',req,r);return r;
end $$;
create function public.update_debt_plan(p_key uuid,p_id uuid,p_minimum text,p_apr text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_minimum,p_apr);r uuid;c text;v numeric;
begin
 r:=public.plan_begin(p_key,'update_debt_plan',req);if r is not null then return r;end if;
 select a.currency into c from public.debts d join public.accounts a on a.id=d.account_id where d.id=p_id and d.owner_id=auth.uid() and not d.voided;if not found then raise exception 'Debt unavailable';end if;
 v:=public.plan_money(p_minimum,c);if p_apr is null or p_apr !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Invalid annual rate';end if;
 update public.debts set minimum=v,apr=p_apr::numeric where id=p_id;
 perform public.plan_finish(p_key,'update_debt_plan',req,p_id);return p_id;
end $$;
revoke execute on function public.void_debt,public.update_debt_plan from public,anon;
grant execute on function public.void_debt,public.update_debt_plan to authenticated;
