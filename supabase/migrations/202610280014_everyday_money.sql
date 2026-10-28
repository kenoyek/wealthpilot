-- Explicit recurring confirmations and atomic, deduplicated CSV imports.
-- No scheduled/background postings and no changes to existing financial records.
create table public.recurring_templates (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,
 account_id uuid not null,category_id uuid not null,name text not null check(length(trim(name)) between 1 and 80),
 kind text not null check(kind in ('income','expense')),amount numeric(28,8) not null,
 description text not null default '' check(length(description)<=500),
 cadence text not null check(cadence in ('weekly','monthly','quarterly','yearly')),
 next_due date not null check(next_due between '1900-01-01' and '9998-12-31'),anchor_day integer not null check(anchor_day between 1 and 31),
 active boolean not null default true,revision uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),
 unique(owner_id,id),foreign key(owner_id,account_id) references public.accounts(owner_id,id),foreign key(owner_id,category_id) references public.categories(owner_id,id)
);
create table public.recurring_occurrences (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,template_id uuid not null,due_date date not null,
 entry_id uuid,skipped boolean not null,created_at timestamptz not null default now(),
 unique(owner_id,template_id,due_date),check(skipped=(entry_id is null)),
 foreign key(owner_id,template_id) references public.recurring_templates(owner_id,id),foreign key(owner_id,entry_id) references public.entries(owner_id,id)
);
create table public.import_batches (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,
 account_id uuid not null,imported integer not null default 0,skipped integer not null default 0,undone boolean not null default false,
 created_at timestamptz not null default now(),unique(owner_id,id),foreign key(owner_id,account_id) references public.accounts(owner_id,id)
);
create table public.import_rows (
 owner_id uuid not null,account_id uuid not null,fingerprint text not null,payload jsonb not null,batch_id uuid not null,entry_id uuid not null,
 primary key(owner_id,account_id,fingerprint),foreign key(owner_id,account_id) references public.accounts(owner_id,id),
 foreign key(owner_id,batch_id) references public.import_batches(owner_id,id),foreign key(owner_id,entry_id) references public.entries(owner_id,id)
);
alter table public.recurring_templates enable row level security;
alter table public.recurring_occurrences enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
create policy own_recurring on public.recurring_templates for select to authenticated using(owner_id=auth.uid());
create policy own_occurrences on public.recurring_occurrences for select to authenticated using(owner_id=auth.uid());
create policy own_import_batches on public.import_batches for select to authenticated using(owner_id=auth.uid());
create policy own_import_rows on public.import_rows for select to authenticated using(owner_id=auth.uid());
revoke all on public.recurring_templates,public.recurring_occurrences,public.import_batches,public.import_rows from public,anon,authenticated;
grant select on public.recurring_templates,public.recurring_occurrences,public.import_batches,public.import_rows to authenticated;
create index recurring_owner_due on public.recurring_templates(owner_id,next_due);
create index occurrences_owner_time on public.recurring_occurrences(owner_id,created_at desc);
create index imports_owner_time on public.import_batches(owner_id,created_at desc);
create index import_rows_batch on public.import_rows(owner_id,batch_id);
create view public.recurring_values with(security_invoker=true) as select id,owner_id,account_id,category_id,name,kind,amount::text,description,cadence,next_due,anchor_day,active,revision,created_at from public.recurring_templates;
grant select on public.recurring_values to authenticated;

create function public.save_recurring(p_key uuid,p_data jsonb,p_id uuid default null,p_revision uuid default null) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare req jsonb:=jsonb_build_array(p_id,p_revision,p_data);r uuid;t public.recurring_templates;a public.accounts;v numeric;d date;
begin
 r:=public.plan_begin(p_key,'save_recurring',req);if r is not null then return r;end if;
 select * into a from public.accounts where id=(p_data->>'account')::uuid and owner_id=auth.uid() and not archived;
 if not found then raise exception 'Choose an available account';end if;
 if not exists(select 1 from public.categories where id=(p_data->>'category')::uuid and owner_id=auth.uid() and scope=a.scope and kind=p_data->>'kind') then raise exception 'Choose a matching category';end if;
 v:=public.plan_money(p_data->>'amount',a.currency);d:=(p_data->>'date')::date;
 if p_id is null then
  if (select count(*) from public.recurring_templates where owner_id=auth.uid())>=200 then raise exception 'Recurring schedule limit reached';end if;
  insert into public.recurring_templates(owner_id,account_id,category_id,name,kind,amount,description,cadence,next_due,anchor_day)
  values(auth.uid(),a.id,(p_data->>'category')::uuid,trim(p_data->>'name'),p_data->>'kind',v,coalesce(p_data->>'description',''),p_data->>'cadence',d,extract(day from d)) returning id into r;
 else
  select * into t from public.recurring_templates where id=p_id and owner_id=auth.uid();
  if not found or p_revision is distinct from t.revision then raise exception 'Schedule changed; refresh before saving';end if;
  if exists(select 1 from public.recurring_occurrences where owner_id=auth.uid() and template_id=t.id and due_date=d) then raise exception 'That occurrence was already handled; choose a later due date';end if;
  update public.recurring_templates set account_id=a.id,category_id=(p_data->>'category')::uuid,name=trim(p_data->>'name'),kind=p_data->>'kind',amount=v,description=coalesce(p_data->>'description',''),cadence=p_data->>'cadence',next_due=d,anchor_day=extract(day from d),revision=gen_random_uuid() where id=t.id returning id into r;
 end if;
 perform public.plan_finish(p_key,'save_recurring',req,r);return r;
end $$;
create function public.set_recurring_active(p_key uuid,p_id uuid,p_revision uuid,p_active boolean) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare req jsonb:=jsonb_build_array(p_id,p_revision,p_active);r uuid;t public.recurring_templates;
begin
 r:=public.plan_begin(p_key,'set_recurring_active',req);if r is not null then return r;end if;
 select * into t from public.recurring_templates where id=p_id and owner_id=auth.uid();
 if not found or t.revision is distinct from p_revision then raise exception 'Schedule changed; refresh first';end if;
 if p_active is null then raise exception 'Choose pause or resume';end if;
 update public.recurring_templates set active=p_active,revision=gen_random_uuid() where id=t.id;
 perform public.plan_finish(p_key,'set_recurring_active',req,t.id);return t.id;
end $$;
create function public.resolve_recurring(p_key uuid,p_id uuid,p_revision uuid,p_due date,p_date date,p_skip boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare req jsonb:=jsonb_build_array(p_id,p_revision,p_due,p_date,p_skip);r uuid;t public.recurring_templates;e uuid;d date;
begin
 r:=public.plan_begin(p_key,'resolve_recurring',req);if r is not null then return r;end if;
 select * into t from public.recurring_templates where id=p_id and owner_id=auth.uid() and active;
 if not found or t.revision is distinct from p_revision or t.next_due is distinct from p_due then raise exception 'Schedule changed or occurrence already handled; refresh first';end if;
 if p_skip is null or p_date is null or p_date<'1900-01-01' or p_date>public.plan_today() then raise exception 'Use an actual transaction date through today';end if;
 if not p_skip then e:=public.post_entry(gen_random_uuid(),t.kind,t.account_id,trim_scale(t.amount)::text,p_date,t.description,t.category_id);end if;
 insert into public.recurring_occurrences(owner_id,template_id,due_date,entry_id,skipped) values(auth.uid(),t.id,p_due,e,p_skip) returning id into r;
 d:=public.next_cycle(t.next_due,t.cadence,t.anchor_day);
 update public.recurring_templates set next_due=case when d<='9998-12-31' then d else t.next_due end,active=(d<='9998-12-31'),revision=gen_random_uuid() where id=t.id;
 perform public.plan_finish(p_key,'resolve_recurring',req,r);return r;
end $$;

create function public.import_transactions(p_key uuid,p_account uuid,p_rows jsonb,p_preview boolean default true) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare req jsonb:=jsonb_build_array(p_account,p_rows);r uuid;a public.accounts;b public.import_batches;item jsonb;payload jsonb;old jsonb;seen jsonb:='{}';fp text;ref text;entry_kind text;description text;v numeric;d date;category uuid;e uuid;idx integer:=0;added integer:=0;n_skipped integer:=0;details jsonb:='[]';status text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_preview is null then raise exception 'Choose preview or import';end if;
 if not p_preview then
  r:=public.plan_begin(p_key,'import_transactions',req);
  if r is not null then select * into b from public.import_batches where id=r and owner_id=auth.uid();return jsonb_build_object('imported',b.imported,'skipped',b.skipped,'replayed',true);end if;
 end if;
 select * into a from public.accounts where id=p_account and owner_id=auth.uid() and not archived;
 if not found then raise exception 'Choose an available account';end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Provide transaction rows';end if;
 if jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text)>262144 then raise exception 'Import 1 to 200 rows, at most 256 KiB';end if;
 if not p_preview then insert into public.import_batches(owner_id,account_id) values(auth.uid(),a.id) returning id into r;end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  idx:=idx+1;
  begin
   entry_kind:=item->>'kind';description:=trim(coalesce(item->>'description',''));ref:=trim(coalesce(item->>'reference',''));
   if entry_kind is null or entry_kind not in ('income','expense') or length(description)>500 or length(ref)>160 then raise exception 'Invalid type, description or reference';end if;
   v:=public.plan_money(item->>'amount',a.currency);d:=(item->>'date')::date;category:=(item->>'category')::uuid;
   if d is null or d<'1900-01-01' or d>public.plan_today() then raise exception 'Use an actual date through today';end if;
   if not exists(select 1 from public.categories c where c.id=category and c.owner_id=auth.uid() and c.kind=entry_kind and c.scope=a.scope) then raise exception 'Choose a matching category';end if;
   payload:=jsonb_build_array(entry_kind,trim_scale(v)::text,d,description);
   fp:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),a.id,case when ref<>'' then jsonb_build_array('reference',ref) else jsonb_build_array('content',payload) end)::text,'UTF8')),'hex');
   old:=null;status:='new';
   if seen ? fp then old:=seen->fp;status:='duplicate in file';
   else select ir.payload into old from public.import_rows ir where ir.owner_id=auth.uid() and ir.account_id=a.id and ir.fingerprint=fp;if found then status:='already imported';end if;end if;
   if old is not null and old<>payload then raise exception 'Reference is already used with different transaction details';end if;
   seen:=jsonb_set(seen,array[fp],payload);
   if status='new' then
    added:=added+1;
    if not p_preview then
     e:=public.post_entry(gen_random_uuid(),entry_kind,a.id,trim_scale(v)::text,d,description,category);
     insert into public.import_rows values(auth.uid(),a.id,fp,payload,r,e);
    end if;
   else n_skipped:=n_skipped+1;end if;
   details:=details||jsonb_build_array(jsonb_build_object('number',idx,'status',status));
  exception when others then raise exception 'Row %: %',idx,sqlerrm;
  end;
 end loop;
 if not p_preview then
  update public.import_batches set imported=added,skipped=n_skipped where id=r;
  perform public.plan_finish(p_key,'import_transactions',req,r);
 end if;
 return jsonb_build_object('imported',added,'skipped',n_skipped,'rows',details);
end $$;
create function public.undo_import(p_key uuid,p_batch uuid,p_date date) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare req jsonb:=jsonb_build_array(p_batch,p_date);r uuid;b public.import_batches;row record;
begin
 r:=public.plan_begin(p_key,'undo_import',req);if r is not null then return r;end if;
 select * into b from public.import_batches where id=p_batch and owner_id=auth.uid();
 if not found then raise exception 'Import unavailable';end if;
 if p_date is null or p_date<'1900-01-01' or p_date>public.plan_today() then raise exception 'Use a reversal date through today';end if;
 if not b.undone then
  for row in select ir.entry_id from public.import_rows ir where ir.batch_id=b.id and ir.owner_id=auth.uid() and not exists(select 1 from public.entries e where e.owner_id=auth.uid() and e.related_entry=ir.entry_id and e.kind='reversal') loop
   perform public.reverse_entry(row.entry_id,gen_random_uuid(),p_date,'Undo CSV import');
  end loop;
  update public.import_batches set undone=true where id=b.id;
 end if;
 perform public.plan_finish(p_key,'undo_import',req,b.id);return b.id;
end $$;
revoke execute on function public.save_recurring,public.set_recurring_active,public.resolve_recurring,public.import_transactions,public.undo_import from public,anon;
grant execute on function public.save_recurring,public.set_recurring_active,public.resolve_recurring,public.import_transactions,public.undo_import to authenticated;
