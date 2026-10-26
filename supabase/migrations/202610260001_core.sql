-- Financial writes go through owner-checking RPCs, never direct table writes.
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 currency text not null default 'NGN' check(currency in ('NGN','USD','CAD','GBP','EUR','JPY')),
 timezone text not null default 'Africa/Lagos', onboarded boolean not null default false
);
create table public.accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 name text not null check(length(name) between 1 and 80), currency text not null check(currency in ('NGN','USD','CAD','GBP','EUR','JPY')),
 scope text not null check(scope in ('personal','business')), archived boolean not null default false,
 created_at timestamptz not null default now(), unique(owner_id,id)
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 name text not null check(length(name) between 1 and 80), kind text not null check(kind in ('income','expense')),
 scope text not null check(scope in ('personal','business')), unique(owner_id,id), unique(owner_id,name,kind,scope)
);
create table public.entries (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 kind text not null check(kind in ('income','expense','transfer','refund','opening','reversal')),
 effective_date date not null, description text not null default '' check(length(description)<=500),
 scope text not null check(scope in ('personal','business')), currency text not null,
 category_id uuid, related_entry uuid, idempotency_key uuid not null, request jsonb not null,
 created_at timestamptz not null default now(), unique(owner_id,id), unique(owner_id,idempotency_key),
 foreign key(owner_id,category_id) references public.categories(owner_id,id),
 foreign key(owner_id,related_entry) references public.entries(owner_id,id)
);
create unique index one_reversal on public.entries(related_entry) where kind='reversal';
create table public.lines (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, entry_id uuid not null,
 account_id uuid, bucket text not null check(bucket in ('asset','income','expense','equity')),
 amount numeric(28,8) not null check(amount<>0 and amount::text not in ('NaN','Infinity','-Infinity')),
 foreign key(owner_id,entry_id) references public.entries(owner_id,id) on delete cascade,
 foreign key(owner_id,account_id) references public.accounts(owner_id,id),
 check((bucket='asset')=(account_id is not null))
);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 category_id uuid not null, month date not null check(extract(day from month)=1),
 currency text not null check(currency in ('NGN','USD','CAD','GBP','EUR','JPY')),
 amount numeric(28,8) not null check(amount>0 and amount::text not in ('NaN','Infinity','-Infinity') and amount=round(amount,case when currency='JPY' then 0 else 2 end)),
 threshold integer not null default 90 check(threshold between 1 and 100),
 foreign key(owner_id,category_id) references public.categories(owner_id,id), unique(owner_id,category_id,month,currency)
);
create table public.audit_logs (
 id bigint generated always as identity primary key, owner_id uuid not null references auth.users on delete cascade,
 entry_id uuid not null, action text not null, created_at timestamptz not null default now(),
 foreign key(owner_id,entry_id) references public.entries(owner_id,id) on delete cascade
);
create index entries_owner_date on public.entries(owner_id,effective_date,id);
create index lines_owner_entry on public.lines(owner_id,entry_id);
create index lines_owner_account on public.lines(owner_id,account_id);

-- Tables are not mutable by API roles except preferences and budgets/categories.
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.lines enable row level security;
alter table public.budgets enable row level security;
alter table public.audit_logs enable row level security;
create policy own_profile on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_accounts on public.accounts for select to authenticated using(owner_id=auth.uid());
create policy own_categories on public.categories for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy own_entries on public.entries for select to authenticated using(owner_id=auth.uid());
create policy own_lines on public.lines for select to authenticated using(owner_id=auth.uid());
create policy own_budgets on public.budgets for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy own_audit on public.audit_logs for select to authenticated using(owner_id=auth.uid());
revoke all on public.accounts,public.entries,public.lines,public.audit_logs from anon,authenticated;
grant select on public.accounts,public.entries,public.lines,public.audit_logs to authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.categories,public.budgets to authenticated;

-- Deferred conservation check makes partial postings impossible even in RPCs.
create function public.check_balance() returns trigger language plpgsql set search_path=public as $$
declare target uuid; n integer; net numeric;
begin
 target:=coalesce(new.entry_id,old.entry_id);
 if not exists(select 1 from public.entries where id=target) then return null; end if;
 select count(*),coalesce(sum(amount),0) into n,net from public.lines where entry_id=target;
 if n<2 or net<>0 then raise exception 'Unbalanced journal'; end if;
 return null;
end $$;
create constraint trigger balanced_journal after insert or update or delete on public.lines deferrable initially deferred for each row execute function public.check_balance();

create function public.post_entry(p_key uuid,p_kind text,p_account uuid,p_amount text,p_date date,p_description text default '',p_category uuid default null,p_destination uuid default null,p_related uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); a public.accounts; d public.accounts; c public.categories; original public.entries;
 eid uuid; existing public.entries; value numeric; req jsonb; previous numeric;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_key is null then raise exception 'Idempotency key required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 req:=jsonb_build_array(p_kind,p_account,p_amount,p_date,p_description,p_category,p_destination,p_related);
 select * into existing from public.entries where owner_id=uid and idempotency_key=p_key;
 if found then
   if existing.request<>req then raise exception 'Idempotency key already used with different data'; end if;
   return existing.id;
 end if;
 if p_kind not in ('income','expense','transfer','refund','opening') then raise exception 'Unsupported entry kind'; end if;
 if p_date is null or p_date<'1900-01-01' or p_date>'9998-12-31' then raise exception 'Invalid effective date'; end if;
 if p_description is null or length(p_description)>500 then raise exception 'Description too long'; end if;
 select * into a from public.accounts where id=p_account and owner_id=uid and not archived;
 if not found then raise exception 'Account unavailable'; end if;
 if p_amount is null or p_amount !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Invalid decimal amount'; end if;
 value:=p_amount::numeric;
 if value<=0 or value>=100000000000000000000 or value<>round(value,case when a.currency='JPY' then 0 else 2 end) then raise exception 'Invalid amount precision or range'; end if;
 if p_kind in ('income','expense') then
   select * into c from public.categories where id=p_category and owner_id=uid and kind=p_kind and scope=a.scope;
   if not found then raise exception 'Choose a matching category and scope'; end if;
 elsif p_kind='transfer' then
   select * into d from public.accounts where id=p_destination and owner_id=uid and not archived;
   if not found or d.id=a.id or d.currency<>a.currency then raise exception 'Choose a different account in the same currency'; end if;
 elsif p_kind='refund' then
   select * into original from public.entries where id=p_related and owner_id=uid and kind='expense';
   if not found or original.currency<>a.currency or original.scope<>a.scope then raise exception 'Original expense unavailable or currency/scope mismatch'; end if;
   if exists(select 1 from public.entries where related_entry=original.id and kind='reversal') then raise exception 'Expense has been reversed'; end if;
   select coalesce(sum(l.amount),0) into previous from public.entries e join public.lines l on l.entry_id=e.id and l.bucket='asset' where e.related_entry=original.id and e.kind='refund' and not exists(select 1 from public.entries r where r.related_entry=e.id and r.kind='reversal');
   if value+previous>(select sum(amount) from public.lines where entry_id=original.id and bucket='expense') then raise exception 'Refund exceeds expense'; end if;
   p_category:=original.category_id;
 else
   if exists(select 1 from public.lines where account_id=a.id) then raise exception 'Opening balance must be the first account entry'; end if;
 end if;
 insert into public.entries(owner_id,kind,effective_date,description,scope,currency,category_id,related_entry,idempotency_key,request)
 values(uid,p_kind,p_date,p_description,a.scope,a.currency,case when p_kind in ('income','expense','refund') then p_category end,case when p_kind='refund' then p_related end,p_key,req) returning id into eid;
 if p_kind='transfer' then
   insert into public.lines(owner_id,entry_id,account_id,bucket,amount) values(uid,eid,a.id,'asset',-value),(uid,eid,d.id,'asset',value);
 elsif p_kind='expense' then
   insert into public.lines(owner_id,entry_id,account_id,bucket,amount) values(uid,eid,a.id,'asset',-value),(uid,eid,null,'expense',value);
 elsif p_kind='income' then
   insert into public.lines(owner_id,entry_id,account_id,bucket,amount) values(uid,eid,a.id,'asset',value),(uid,eid,null,'income',-value);
 elsif p_kind='refund' then
   insert into public.lines(owner_id,entry_id,account_id,bucket,amount) values(uid,eid,a.id,'asset',value),(uid,eid,null,'expense',-value);
 else
   insert into public.lines(owner_id,entry_id,account_id,bucket,amount) values(uid,eid,a.id,'asset',value),(uid,eid,null,'equity',-value);
 end if;
 insert into public.audit_logs(owner_id,entry_id,action) values(uid,eid,'posted');
 return eid;
end $$;

create function public.create_account(p_name text,p_currency text,p_scope text,p_opening text default '0') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare aid uuid; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from public.accounts where owner_id=uid)>=100 then raise exception 'Account limit reached'; end if;
 insert into public.accounts(owner_id,name,currency,scope) values(uid,trim(p_name),p_currency,p_scope) returning id into aid;
 if p_opening<>'0' then perform public.post_entry(gen_random_uuid(),'opening',aid,p_opening,current_date,'Opening balance'); end if;
 return aid;
end $$;
create function public.archive_account(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.accounts set archived=true where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'Account unavailable'; end if;
end $$;
create function public.reverse_entry(p_id uuid,p_key uuid,p_date date,p_reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare original public.entries; eid uuid; uid uuid:=auth.uid(); existing public.entries; req jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 req:=jsonb_build_array(p_id,p_date,p_reason);
 select * into existing from public.entries where owner_id=uid and idempotency_key=p_key;
 if found then
   if existing.request<>req then raise exception 'Idempotency key already used'; end if;
   return existing.id;
 end if;
 select * into original from public.entries where id=p_id and owner_id=uid and kind<>'reversal';
 if not found then raise exception 'Entry unavailable'; end if;
 if p_date is null or p_date<'1900-01-01' or p_date>'9998-12-31' or length(trim(p_reason))<3 then raise exception 'Effective date and correction reason required'; end if;
 if exists(select 1 from public.entries where related_entry=p_id and kind='reversal') then raise exception 'Already reversed'; end if;
 if original.kind='expense' and exists(select 1 from public.entries e where e.related_entry=p_id and e.kind='refund' and not exists(select 1 from public.entries r where r.related_entry=e.id and r.kind='reversal')) then raise exception 'Reverse associated refunds first'; end if;
 insert into public.entries(owner_id,kind,effective_date,description,scope,currency,category_id,related_entry,idempotency_key,request)
 values(uid,'reversal',p_date,p_reason,original.scope,original.currency,original.category_id,p_id,p_key,req) returning id into eid;
 insert into public.lines(owner_id,entry_id,account_id,bucket,amount) select uid,eid,account_id,bucket,-amount from public.lines where entry_id=p_id;
 insert into public.audit_logs(owner_id,entry_id,action) values(uid,eid,'reversed');
 return eid;
end $$;
-- Numeric values are explicitly serialized as strings before PostgREST JSON conversion.
create view public.account_balances with (security_invoker=true) as
select a.*,coalesce(sum(l.amount),0)::text as balance from public.accounts a left join public.lines l on l.account_id=a.id group by a.id;
create view public.journal with (security_invoker=true) as
select e.*,l.id as line_id,l.account_id,l.bucket,l.amount::text as amount from public.entries e join public.lines l on l.entry_id=e.id;
create view public.budget_values with (security_invoker=true) as select b.id,b.owner_id,b.category_id,b.month,b.currency,b.amount::text as amount,b.threshold from public.budgets b;
grant select on public.account_balances,public.journal,public.budget_values to authenticated;
revoke execute on function public.post_entry,public.create_account,public.archive_account,public.reverse_entry,public.check_balance from public,anon;
grant execute on function public.post_entry,public.create_account,public.archive_account,public.reverse_entry to authenticated;
-- Category labels can change; referenced financial classification cannot.
revoke update on public.categories from authenticated;
grant update(name) on public.categories to authenticated;
create function public.validate_profile_timezone() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid IANA timezone'; end if;
 return new;
end $$;
create trigger profile_timezone before insert or update on public.profiles for each row execute function public.validate_profile_timezone();
revoke execute on function public.validate_profile_timezone from public,anon,authenticated;
create index entries_owner_created on public.entries(owner_id,created_at);
-- Database-side per-owner posting throttle also applies to direct RPC clients.
create function public.enforce_posting_limit() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (select count(*) from public.entries where owner_id=new.owner_id and created_at>now()-interval '1 minute')>=60 then raise exception 'Posting limit reached. Try again in a minute.'; end if;
 return new;
end $$;
create trigger posting_limit before insert on public.entries for each row execute function public.enforce_posting_limit();
revoke execute on function public.enforce_posting_limit from public,anon,authenticated;
