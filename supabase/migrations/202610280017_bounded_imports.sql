-- Only trusted import/undo functions can open a bounded bulk context.
create table security_private.bulk_writes(owner_id uuid not null,transaction_id xid8 not null,writes integer not null default 0,primary key(owner_id,transaction_id));
revoke all on security_private.bulk_writes from public,anon,authenticated;
create function security_private.begin_bulk_write(u uuid) returns void language sql security definer set search_path=pg_catalog,security_private as $$insert into security_private.bulk_writes values(u,pg_current_xact_id(),0) on conflict(owner_id,transaction_id) do update set writes=0$$;
create function security_private.end_bulk_write(u uuid) returns void language sql security definer set search_path=pg_catalog,security_private as $$delete from security_private.bulk_writes where owner_id=u and transaction_id=pg_current_xact_id()$$;
revoke execute on function security_private.begin_bulk_write,security_private.end_bulk_write from public,anon,authenticated;
create or replace function public.enforce_posting_limit() returns trigger language plpgsql security definer set search_path=pg_catalog,public,security_private as $$
declare n integer;
begin
 update security_private.bulk_writes set writes=writes+1 where owner_id=new.owner_id and transaction_id=pg_current_xact_id() returning writes into n;
 if found then
  if n>200 or (select count(*) from public.entries where owner_id=new.owner_id and created_at>now()-interval '1 minute')>=1000 then raise exception 'Bulk posting limit reached; try again in a minute';end if;
 else
  if (select count(*) from public.entries where owner_id=new.owner_id and created_at>now()-interval '1 minute')>=60 then raise exception 'Posting limit reached. Try again in a minute.';end if;
 end if;
 return new;
end $$;
create or replace function public.import_transactions(p_key uuid,p_account uuid,p_rows jsonb,p_preview boolean default true) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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
 if not p_preview then perform security_private.begin_bulk_write(auth.uid());end if;
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
  perform security_private.end_bulk_write(auth.uid());
 end if;
 return jsonb_build_object('imported',added,'skipped',n_skipped,'rows',details);
end $$;
create or replace function public.undo_import(p_key uuid,p_batch uuid,p_date date) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare req jsonb:=jsonb_build_array(p_batch,p_date);r uuid;b public.import_batches;row record;
begin
 r:=public.plan_begin(p_key,'undo_import',req);if r is not null then return r;end if;
 select * into b from public.import_batches where id=p_batch and owner_id=auth.uid();
 if not found then raise exception 'Import unavailable';end if;
 if p_date is null or p_date<'1900-01-01' or p_date>public.plan_today() then raise exception 'Use a reversal date through today';end if;
 perform security_private.begin_bulk_write(auth.uid());
 if not b.undone then
  for row in select ir.entry_id from public.import_rows ir where ir.batch_id=b.id and ir.owner_id=auth.uid() and not exists(select 1 from public.entries e where e.owner_id=auth.uid() and e.related_entry=ir.entry_id and e.kind='reversal') loop
   perform public.reverse_entry(row.entry_id,gen_random_uuid(),p_date,'Undo CSV import');
  end loop;
  update public.import_batches set undone=true where id=b.id;
 end if;
 perform security_private.end_bulk_write(auth.uid());
 perform public.plan_finish(p_key,'undo_import',req,b.id);return b.id;
end $$;
