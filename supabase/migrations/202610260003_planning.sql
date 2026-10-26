-- Phase 2: virtual earmarks and explicit, ledger-backed payment recording.
create function public.plan_money(v text,c text,zero_ok boolean default false) returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
declare n numeric;
begin
 if c not in ('NGN','USD','CAD','GBP','EUR','JPY') or c is null or v is null or length(v)>50 or v !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Invalid currency or decimal amount'; end if;
 n:=v::numeric;
 if n<0 or (not zero_ok and n=0) or n>=100000000000000000000 or n<>round(n,case when c='JPY' then 0 else 2 end) then raise exception 'Invalid monetary precision or range'; end if;
 return n;
end $$;
create function public.next_cycle(d date,f text,anchor integer) returns date language plpgsql immutable set search_path=public,pg_temp as $$
declare first_day date;
begin
 if f='once' then return null; elsif f='weekly' then return d+7; end if;
 if f not in ('monthly','quarterly','yearly') then raise exception 'Invalid recurrence'; end if;
 first_day:=(date_trunc('month',d)+case f when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months' else interval '1 year' end)::date;
 return first_day+least(anchor,extract(day from first_day+interval '1 month - 1 day')::integer)-1;
end $$;
create table public.planning_requests(owner_id uuid not null references auth.users on delete cascade,key uuid not null,operation text not null,payload jsonb not null,result_id uuid not null,created_at timestamptz not null default now(),primary key(owner_id,key));
create index planning_request_time on public.planning_requests(owner_id,created_at);
create table public.goals(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,account_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 80),kind text not null check(kind in ('goal','emergency','tax','operating','obligation')),
 target numeric(28,8) not null, target_date date not null check(target_date between '1900-01-01' and '9998-12-31'),priority integer not null default 1 check(priority between 1 and 5),
 monthly_plan numeric(28,8) not null default 0,essential_monthly numeric(28,8) not null default 0,archived boolean not null default false,
 unique(owner_id,id),foreign key(owner_id,account_id) references public.accounts(owner_id,id)
);
create table public.goal_events(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,goal_id uuid not null,amount numeric(28,8) not null check(amount<>0),effective_date date not null,
 source_entry uuid,batch_id uuid,reason text not null,created_at timestamptz not null default now(),
 foreign key(owner_id,goal_id) references public.goals(owner_id,id),foreign key(owner_id,source_entry) references public.entries(owner_id,id)
);
create index goal_event_owner_goal on public.goal_events(owner_id,goal_id);
create table public.commitments(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,account_id uuid not null,category_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 80),kind text not null check(kind in ('bill','subscription')),plan text not null default '' check(length(plan)<=100),
 amount numeric(28,8) not null,cadence text not null check(cadence in ('once','weekly','monthly','quarterly','yearly')),next_due date,anchor_day integer not null check(anchor_day between 1 and 31),
 essential boolean not null default true,cancel_url text not null default '' check(cancel_url='' or cancel_url ~ '^https://'),reserve_goal_id uuid,active boolean not null default true,
 unique(owner_id,id),foreign key(owner_id,account_id) references public.accounts(owner_id,id),foreign key(owner_id,category_id) references public.categories(owner_id,id),foreign key(owner_id,reserve_goal_id) references public.goals(owner_id,id)
);
create table public.commitment_prices(id uuid primary key default gen_random_uuid(),owner_id uuid not null,commitment_id uuid not null,amount numeric(28,8) not null,recorded_at timestamptz not null default now(),foreign key(owner_id,commitment_id) references public.commitments(owner_id,id));
create table public.commitment_payments(id uuid primary key default gen_random_uuid(),owner_id uuid not null,commitment_id uuid not null,entry_id uuid not null,due_date date not null,next_due_after date,released numeric(28,8) not null default 0,undone_entry uuid,
 foreign key(owner_id,commitment_id) references public.commitments(owner_id,id),foreign key(owner_id,entry_id) references public.entries(owner_id,id),foreign key(owner_id,undone_entry) references public.entries(owner_id,id),unique(owner_id,id));
create unique index commitment_cycle_paid on public.commitment_payments(commitment_id,due_date) where undone_entry is null;
create table public.debts(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,name text not null check(length(trim(name)) between 1 and 80),
 account_id uuid not null,principal numeric(28,8) not null,minimum numeric(28,8) not null,apr numeric(7,4) not null default 0 check(apr between 0 and 1000),
 next_due date not null,anchor_day integer not null check(anchor_day between 1 and 31),reserve_goal_id uuid,
 unique(owner_id,id),foreign key(owner_id,account_id) references public.accounts(owner_id,id),foreign key(owner_id,reserve_goal_id) references public.goals(owner_id,id)
);
create table public.debt_payments(id uuid primary key default gen_random_uuid(),owner_id uuid not null,debt_id uuid not null,entry_id uuid not null,principal numeric(28,8) not null,interest numeric(28,8) not null,due_date date not null,next_due_after date not null,released numeric(28,8) not null default 0,undone_entry uuid,
 foreign key(owner_id,debt_id) references public.debts(owner_id,id),foreign key(owner_id,entry_id) references public.entries(owner_id,id),foreign key(owner_id,undone_entry) references public.entries(owner_id,id),unique(owner_id,id));
create index debt_payment_debt on public.debt_payments(owner_id,debt_id);
create table public.allocation_batches(id uuid primary key default gen_random_uuid(),owner_id uuid not null,entry_id uuid not null,undone boolean not null default false,created_at timestamptz not null default now(),unique(owner_id,id),foreign key(owner_id,entry_id) references public.entries(owner_id,id));
create table public.planning_audit(id bigint generated always as identity primary key,owner_id uuid not null references auth.users on delete cascade,operation text not null,entity_id uuid not null,created_at timestamptz not null default now());
alter table public.profiles add column planning_alerts boolean not null default true,add column reminder_days integer not null default 7 check(reminder_days between 0 and 90);
alter table public.lines drop constraint lines_bucket_check;
alter table public.lines add constraint lines_bucket_check check(bucket in ('asset','income','expense','equity','liability'));
alter table public.entries drop constraint entries_kind_check;
alter table public.entries add constraint entries_kind_check check(kind in ('income','expense','transfer','refund','opening','reversal','debt_opening','debt_payment'));
-- All state changes require RPC ownership checks. SELECT RLS also protects invoker views.
do $$ declare t text; begin
 foreach t in array array['planning_requests','goals','goal_events','commitments','commitment_prices','commitment_payments','debts','debt_payments','allocation_batches','planning_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for select to authenticated using(owner_id=auth.uid())',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create function public.plan_begin(k uuid,op text,p jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.planning_requests; u uuid:=auth.uid();
begin
 if u is null or k is null then raise exception 'Authentication and request key required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into r from public.planning_requests where owner_id=u and key=k;
 if found then if r.operation<>op or r.payload<>p then raise exception 'Request key already used with different data'; end if;return r.result_id;end if;
 if (select count(*) from public.planning_requests where owner_id=u and created_at>now()-interval '1 minute')>=60 then raise exception 'Planning request limit reached'; end if;
 return null;
end $$;
create function public.plan_finish(k uuid,op text,p jsonb,r uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.planning_requests values(auth.uid(),k,op,p,r,now());
 insert into public.planning_audit(owner_id,operation,entity_id) values(auth.uid(),op,r);
end $$;
create function public.goal_funded(g uuid) returns numeric language sql stable set search_path=public,pg_temp as $$select coalesce(sum(amount),0) from public.goal_events where goal_id=g and owner_id=auth.uid()$$;
create function public.plan_today() returns date language sql stable set search_path=public,pg_temp as $$select (now() at time zone coalesce((select timezone from public.profiles where id=auth.uid()),'Africa/Lagos'))::date$$;

create function public.planning_position(p_account uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
 for c in select * from public.debts where owner_id=auth.uid() and account_id=a.id loop
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

-- The same owner advisory lock is shared with Phase 1 posting RPCs.
create function public.check_goal_backing() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare uid uuid:=coalesce(new.owner_id,old.owner_id);a record;held numeric;cash numeric;
begin
 for a in select id from public.accounts where owner_id=uid loop
  select coalesce(sum(e.amount),0) into held from public.goal_events e join public.goals g on g.id=e.goal_id where g.account_id=a.id;
  select coalesce(sum(amount),0) into cash from public.lines where account_id=a.id;
  if held<0 or (held>0 and held>cash) then raise exception 'Release goal reserves before spending this cash';end if;
 end loop;
 if exists(select 1 from public.goal_events where owner_id=uid group by goal_id having sum(amount)<0) then raise exception 'Goal reserve cannot be negative';end if;
 return null;
end $$;
create constraint trigger goals_cash_backing after insert or update or delete on public.goal_events deferrable initially deferred for each row execute function public.check_goal_backing();
create constraint trigger ledger_goal_backing after insert or update or delete on public.lines deferrable initially deferred for each row execute function public.check_goal_backing();

create function public.save_goal(p_key uuid,p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_data);r uuid;a public.accounts;t numeric;g public.goals;
begin
 r:=public.plan_begin(p_key,'save_goal',req);if r is not null then return r;end if;
 select * into a from public.accounts where id=(p_data->>'account')::uuid and owner_id=auth.uid() and not archived;if not found then raise exception 'Account unavailable';end if;
 t:=public.plan_money(p_data->>'target',a.currency);
 if p_id is not null then select * into g from public.goals where id=p_id and owner_id=auth.uid();if not found or g.account_id<>a.id then raise exception 'Goal unavailable or account cannot change';end if;
 if t<public.goal_funded(p_id) then raise exception 'Release excess reserves before reducing the target';end if;
 else if (select count(*) from public.goals where owner_id=auth.uid())>=200 then raise exception 'Goal limit reached';end if;p_id:=gen_random_uuid();end if;
 insert into public.goals(id,owner_id,account_id,name,kind,target,target_date,priority,monthly_plan,essential_monthly)
 values(p_id,auth.uid(),a.id,p_data->>'name',p_data->>'kind',t,(p_data->>'date')::date,(p_data->>'priority')::integer,public.plan_money(coalesce(p_data->>'monthly','0'),a.currency,true),public.plan_money(coalesce(p_data->>'essential','0'),a.currency,true))
 on conflict(id) do update set name=excluded.name,kind=excluded.kind,target=excluded.target,target_date=excluded.target_date,priority=excluded.priority,monthly_plan=excluded.monthly_plan,essential_monthly=excluded.essential_monthly;
 perform public.plan_finish(p_key,'save_goal',req,p_id);return p_id;
end $$;
create function public.fund_goal(p_key uuid,p_goal uuid,p_amount text,p_release boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_goal,p_amount,p_release);r uuid;g public.goals;a public.accounts;v numeric;funded numeric;
begin
 r:=public.plan_begin(p_key,'fund_goal',req);if r is not null then return r;end if;
 select * into g from public.goals where id=p_goal and owner_id=auth.uid() and not archived;if not found then raise exception 'Goal unavailable';end if;
 select * into a from public.accounts where id=g.account_id and not archived;if not found then raise exception 'Account unavailable';end if;
 v:=public.plan_money(p_amount,a.currency);funded:=public.goal_funded(g.id);
 if p_release then if v>funded then raise exception 'Release exceeds funded amount';end if;v:=-v;
 elsif funded+v>g.target then raise exception 'Contribution exceeds target';end if;
 r:=gen_random_uuid();insert into public.goal_events(id,owner_id,goal_id,amount,effective_date,reason) values(r,auth.uid(),g.id,v,public.plan_today(),case when p_release then 'Released to available cash' else 'Manual contribution' end);
 perform public.plan_finish(p_key,'fund_goal',req,r);return r;
end $$;
create function public.save_commitment(p_key uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r uuid;a public.accounts;c public.categories;gid uuid:=(p_data->>'reserve')::uuid;v numeric;due date:=(p_data->>'date')::date;
begin
 r:=public.plan_begin(p_key,'save_commitment',p_data);if r is not null then return r;end if;
 if (select count(*) from public.commitments where owner_id=auth.uid())>=500 then raise exception 'Commitment limit reached';end if;
 select * into a from public.accounts where id=(p_data->>'account')::uuid and owner_id=auth.uid() and not archived;if not found then raise exception 'Account unavailable';end if;
 select * into c from public.categories where id=(p_data->>'category')::uuid and owner_id=auth.uid() and kind='expense' and scope=a.scope;if not found then raise exception 'Choose a matching expense category';end if;
 if gid is not null and not exists(select 1 from public.goals where id=gid and owner_id=auth.uid() and account_id=a.id and not archived) then raise exception 'Reserve must belong to this account';end if;
 if due is null or due<'1900-01-01' or due>'9997-12-31' then raise exception 'Invalid due date';end if;
 v:=public.plan_money(p_data->>'amount',a.currency);r:=gen_random_uuid();
 insert into public.commitments(id,owner_id,account_id,category_id,name,kind,plan,amount,cadence,next_due,anchor_day,essential,cancel_url,reserve_goal_id)
 values(r,auth.uid(),a.id,c.id,p_data->>'name',p_data->>'kind',coalesce(p_data->>'plan',''),v,p_data->>'cadence',due,extract(day from due),coalesce((p_data->>'essential')::boolean,true),coalesce(p_data->>'url',''),gid);
 insert into public.commitment_prices(owner_id,commitment_id,amount) values(auth.uid(),r,v);
 perform public.plan_finish(p_key,'save_commitment',p_data,r);return r;
end $$;
create function public.change_commitment(p_key uuid,p_id uuid,p_amount text default null,p_stop boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_amount,p_stop);r uuid;c public.commitments;a public.accounts;v numeric;
begin
 r:=public.plan_begin(p_key,'change_commitment',req);if r is not null then return r;end if;
 select * into c from public.commitments where id=p_id and owner_id=auth.uid();if not found then raise exception 'Commitment unavailable';end if;
 if p_stop then update public.commitments set active=false where id=c.id;
 else select * into a from public.accounts where id=c.account_id;v:=public.plan_money(p_amount,a.currency);update public.commitments set amount=v where id=c.id;insert into public.commitment_prices(owner_id,commitment_id,amount) values(auth.uid(),c.id,v);end if;
 perform public.plan_finish(p_key,'change_commitment',req,c.id);return c.id;
end $$;
create function public.pay_commitment(p_key uuid,p_id uuid,p_due date,p_date date,p_quote text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_due,p_date,p_quote);r uuid;c public.commitments;eid uuid;released numeric:=0;nextdue date;
begin
 r:=public.plan_begin(p_key,'pay_commitment',req);if r is not null then return r;end if;
 select * into c from public.commitments where id=p_id and owner_id=auth.uid() and active;if not found or c.next_due is distinct from p_due or p_due is null or c.amount<>public.plan_money(p_quote,(select currency from public.accounts where id=c.account_id)) then raise exception 'Due date or amount changed; refresh before recording';end if;
 eid:=public.post_entry(p_key,'expense',c.account_id,c.amount::text,p_date,'Payment: '||c.name,c.category_id);
 if c.reserve_goal_id is not null then released:=least(c.amount,public.goal_funded(c.reserve_goal_id));if released>0 then insert into public.goal_events(owner_id,goal_id,amount,effective_date,source_entry,reason) values(auth.uid(),c.reserve_goal_id,-released,p_date,eid,'Bill reserve consumed');end if;end if;
 nextdue:=public.next_cycle(c.next_due,c.cadence,c.anchor_day);r:=gen_random_uuid();
 insert into public.commitment_payments(id,owner_id,commitment_id,entry_id,due_date,next_due_after,released) values(r,auth.uid(),c.id,eid,c.next_due,nextdue,released);
 update public.commitments set next_due=nextdue,active=(nextdue is not null) where id=c.id;
 perform public.plan_finish(p_key,'pay_commitment',req,r);return r;
end $$;
create function public.create_debt(p_key uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r uuid;a public.accounts;gid uuid:=(p_data->>'reserve')::uuid;v numeric;m numeric;eid uuid;due date:=(p_data->>'date')::date;
begin
 r:=public.plan_begin(p_key,'create_debt',p_data);if r is not null then return r;end if;
 if (select count(*) from public.debts where owner_id=auth.uid())>=100 then raise exception 'Debt limit reached';end if;
 select * into a from public.accounts where id=(p_data->>'account')::uuid and owner_id=auth.uid() and not archived;if not found then raise exception 'Account unavailable';end if;
 if gid is not null and not exists(select 1 from public.goals where id=gid and owner_id=auth.uid() and account_id=a.id and not archived) then raise exception 'Reserve must belong to this account';end if;
 if due is null or due<'1900-01-01' or due>'9997-12-31' then raise exception 'Invalid due date';end if;
 v:=public.plan_money(p_data->>'principal',a.currency);m:=public.plan_money(p_data->>'minimum',a.currency);r:=gen_random_uuid();
 insert into public.debts(id,owner_id,name,account_id,principal,minimum,apr,next_due,anchor_day,reserve_goal_id) values(r,auth.uid(),p_data->>'name',a.id,v,m,(p_data->>'apr')::numeric,due,extract(day from due),gid);
 insert into public.entries(owner_id,kind,effective_date,description,scope,currency,idempotency_key,request) values(auth.uid(),'debt_opening',public.plan_today(),'Existing debt: '||(p_data->>'name'),a.scope,a.currency,p_key,p_data) returning id into eid;
 insert into public.lines(owner_id,entry_id,bucket,amount) values(auth.uid(),eid,'equity',v),(auth.uid(),eid,'liability',-v);
 perform public.plan_finish(p_key,'create_debt',p_data,r);return r;
end $$;
create function public.pay_debt(p_key uuid,p_id uuid,p_principal text,p_interest text,p_category uuid,p_date date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_id,p_principal,p_interest,p_category,p_date);r uuid;d public.debts;a public.accounts;v numeric;i numeric;remaining numeric;paid numeric;eid uuid;released numeric:=0;nextdue date;
begin
 r:=public.plan_begin(p_key,'pay_debt',req);if r is not null then return r;end if;
 select * into d from public.debts where id=p_id and owner_id=auth.uid();if not found then raise exception 'Debt unavailable';end if;
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
-- Generic reversals cannot bypass the planning schedule and balance updates.
alter function public.reverse_entry(uuid,uuid,date,text) rename to reverse_entry_internal;
revoke execute on function public.reverse_entry_internal from public,anon,authenticated;
create function public.reverse_entry(p_id uuid,p_key uuid,p_date date,p_reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.commitment_payments where entry_id=p_id and owner_id=auth.uid()) or exists(select 1 from public.debt_payments where entry_id=p_id and owner_id=auth.uid()) or exists(select 1 from public.entries where id=p_id and owner_id=auth.uid() and kind='debt_opening') then raise exception 'Use Planning payment undo; debt opening is not an expense';end if;
 return public.reverse_entry_internal(p_id,p_key,p_date,p_reason);
end $$;
create function public.undo_planning_payment(p_key uuid,p_id uuid,p_kind text,p_date date,p_reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
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
  if exists(select 1 from public.debt_payments x join public.entries e on e.id=x.entry_id where x.debt_id=dp.debt_id and x.undone_entry is null and e.created_at>(select created_at from public.entries where id=dp.entry_id)) then raise exception 'Undo newer payments first';end if;
  select reserve_goal_id into gid from public.debts where id=dp.debt_id;
  r:=public.reverse_entry_internal(dp.entry_id,p_key,p_date,p_reason);released:=dp.released;
  update public.debt_payments set undone_entry=r where id=dp.id;
  update public.debts set next_due=dp.due_date where id=dp.debt_id;
 else raise exception 'Unsupported payment type';end if;
 if released>0 then insert into public.goal_events(owner_id,goal_id,amount,effective_date,source_entry,reason) values(auth.uid(),gid,released,p_date,r,'Payment undo restored reserve');end if;
 perform public.plan_finish(p_key,'undo_payment',req,r);return r;
end $$;
create function public.allocate_income(p_key uuid,p_entry uuid,p_plan jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_entry,p_plan);r uuid;e public.entries;aid uuid;received numeric;used numeric;total numeric:=0;item jsonb;g public.goals;v numeric;seen uuid[]:='{}';items integer;
begin
 r:=public.plan_begin(p_key,'allocate',req);if r is not null then return r;end if;
 select * into e from public.entries where id=p_entry and owner_id=auth.uid() and kind='income';
 if not found or exists(select 1 from public.entries where related_entry=p_entry and kind='reversal') then raise exception 'Choose received, unreversed income';end if;
 select account_id,amount into aid,received from public.lines where entry_id=e.id and bucket='asset';
 if not exists(select 1 from public.accounts where id=aid and not archived) then raise exception 'Account archived';end if;
 if jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan)<1 or jsonb_array_length(p_plan)>50 then raise exception 'Choose 1 to 50 goals';end if;
 r:=gen_random_uuid();insert into public.allocation_batches(id,owner_id,entry_id) values(r,auth.uid(),e.id);
 -- Capacity is read before earmarking anything, under the shared owner lock.
 select coalesce(sum(amount),0) into used from public.goal_events where owner_id=auth.uid() and source_entry=e.id;
 for item in select * from jsonb_array_elements(p_plan) loop
  select * into g from public.goals where id=(item->>'goal')::uuid and owner_id=auth.uid() and account_id=aid and not archived;
  if not found or g.id=any(seen) then raise exception 'Choose unique goals in the income account';end if;seen:=array_append(seen,g.id);
  v:=public.plan_money(item->>'amount',e.currency);
  if public.goal_funded(g.id)+v>g.target then raise exception 'Goal target changed; refresh the preview';end if;
  total:=total+v;
 end loop;
 if total>received-used or total>(public.planning_position(aid)->>'safe')::numeric then raise exception 'Cash, commitments or income allocation changed; refresh the preview';end if;
 for item in select * from jsonb_array_elements(p_plan) loop
  insert into public.goal_events(owner_id,goal_id,amount,effective_date,source_entry,batch_id,reason) values(auth.uid(),(item->>'goal')::uuid,(item->>'amount')::numeric,public.plan_today(),e.id,r,'Confirmed income allocation');
 end loop;
 perform public.plan_finish(p_key,'allocate',req,r);return r;
end $$;
create function public.undo_allocation(p_key uuid,p_batch uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_batch);r uuid;b public.allocation_batches;g record;
begin
 r:=public.plan_begin(p_key,'undo_allocation',req);if r is not null then return r;end if;
 select * into b from public.allocation_batches where id=p_batch and owner_id=auth.uid() and not undone;if not found then raise exception 'Allocation unavailable';end if;
 for g in select goal_id,sum(amount) as amount from public.goal_events where batch_id=b.id group by goal_id loop
 if public.goal_funded(g.goal_id)<g.amount then raise exception 'Restore or release later goal changes before undoing this batch';end if;
 insert into public.goal_events(owner_id,goal_id,amount,effective_date,source_entry,reason) values(auth.uid(),g.goal_id,-g.amount,public.plan_today(),b.entry_id,'Income allocation undone');
 end loop;
 update public.allocation_batches set undone=true where id=b.id;
 perform public.plan_finish(p_key,'undo_allocation',req,b.id);return b.id;
end $$;

create view public.goal_values with(security_invoker=true) as select g.id,g.owner_id,g.account_id,g.name,g.kind,g.target::text,g.target_date,g.priority,g.monthly_plan::text,g.essential_monthly::text,g.archived,coalesce(sum(e.amount),0)::text as funded from public.goals g left join public.goal_events e on e.goal_id=g.id group by g.id;
create view public.commitment_values with(security_invoker=true) as select c.id,c.owner_id,c.account_id,c.category_id,c.name,c.kind,c.plan,c.amount::text,c.cadence,c.next_due,c.anchor_day,c.essential,c.cancel_url,c.reserve_goal_id,c.active from public.commitments c;
create view public.debt_values with(security_invoker=true) as select d.id,d.owner_id,d.name,d.account_id,d.principal::text,d.minimum::text,d.apr::text,d.next_due,d.anchor_day,d.reserve_goal_id,(d.principal-coalesce(sum(p.principal),0))::text as remaining from public.debts d left join public.debt_payments p on p.debt_id=d.id and p.undone_entry is null group by d.id;
create view public.goal_history with(security_invoker=true) as select id,owner_id,goal_id,amount::text,effective_date,source_entry,batch_id,reason,created_at from public.goal_events;
create view public.price_history with(security_invoker=true) as select p.id,p.owner_id,p.commitment_id,p.amount::text,p.recorded_at from public.commitment_prices p;
create view public.received_income with(security_invoker=true) as select e.id,e.owner_id,e.description,e.effective_date,e.currency,l.account_id,l.amount::text,(l.amount-coalesce((select sum(amount) from public.goal_events where source_entry=e.id),0))::text as unallocated from public.entries e join public.lines l on l.entry_id=e.id and l.bucket='asset' where e.kind='income' and not exists(select 1 from public.entries r where r.related_entry=e.id and r.kind='reversal');
create view public.payment_history with(security_invoker=true) as
 select p.id,p.owner_id,'commitment'::text as kind,p.commitment_id as entity_id,p.entry_id,p.due_date,p.undone_entry,e.created_at,p.released::text,'0'::text as principal,'0'::text as interest from public.commitment_payments p join public.entries e on e.id=p.entry_id
 union all select p.id,p.owner_id,'debt',p.debt_id,p.entry_id,p.due_date,p.undone_entry,e.created_at,p.released::text,p.principal::text,p.interest::text from public.debt_payments p join public.entries e on e.id=p.entry_id;
grant select on public.goal_values,public.commitment_values,public.debt_values,public.goal_history,public.price_history,public.received_income,public.payment_history to authenticated;
-- Explicit function grants; internal helpers cannot be called directly through PostgREST.
revoke execute on function public.plan_money,public.next_cycle,public.plan_begin,public.plan_finish,public.goal_funded,public.plan_today,public.check_goal_backing from public,anon,authenticated;
revoke execute on function public.planning_position,public.save_goal,public.fund_goal,public.save_commitment,public.change_commitment,public.pay_commitment,public.create_debt,public.pay_debt,public.reverse_entry,public.undo_planning_payment,public.allocate_income,public.undo_allocation from public,anon;
grant execute on function public.planning_position,public.save_goal,public.fund_goal,public.save_commitment,public.change_commitment,public.pay_commitment,public.create_debt,public.pay_debt,public.reverse_entry,public.undo_planning_payment,public.allocate_income,public.undo_allocation to authenticated;
