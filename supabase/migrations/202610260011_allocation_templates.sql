create table public.allocation_templates(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,account_id uuid not null,name text not null check(length(trim(name)) between 1 and 80),weights jsonb not null,unique(owner_id,account_id,name),foreign key(owner_id,account_id) references public.accounts(owner_id,id));
alter table public.allocation_templates enable row level security;
create policy own_templates on public.allocation_templates for select to authenticated using(owner_id=auth.uid());
revoke all on public.allocation_templates from anon,authenticated;
grant select on public.allocation_templates to authenticated;
create function public.save_allocation_template(p_key uuid,p_account uuid,p_name text,p_weights jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare req jsonb:=jsonb_build_array(p_account,p_name,p_weights);r uuid;item jsonb;g uuid;seen uuid[]:='{}';w numeric;total numeric:=0;
begin
 r:=public.plan_begin(p_key,'save_template',req);if r is not null then return r;end if;
 if not exists(select 1 from public.accounts where id=p_account and owner_id=auth.uid() and not archived) then raise exception 'Account unavailable';end if;
 if jsonb_typeof(p_weights)<>'array' or jsonb_array_length(p_weights)<1 or jsonb_array_length(p_weights)>50 then raise exception 'Choose 1 to 50 goals';end if;
 for item in select * from jsonb_array_elements(p_weights) loop
  g:=(item->>'id')::uuid;
  if g=any(seen) or not exists(select 1 from public.goals where id=g and owner_id=auth.uid() and account_id=p_account and not archived) then raise exception 'Choose unique goals in this account';end if;seen:=array_append(seen,g);
  if item->>'weight' is null or length(item->>'weight')>10 or item->>'weight' !~ '^[0-9]+([.][0-9]{1,2})?$' then raise exception 'Use valid percentages with at most two decimals';end if;
  w:=(item->>'weight')::numeric;if w<0 or w>100 then raise exception 'Invalid percentage';end if;total:=total+w;
 end loop;
 if total<>100 then raise exception 'Percentages must total exactly 100';end if;
 if (select count(*) from public.allocation_templates where owner_id=auth.uid())>=100 and not exists(select 1 from public.allocation_templates where owner_id=auth.uid() and account_id=p_account and name=trim(p_name)) then raise exception 'Template limit reached';end if;
 insert into public.allocation_templates(owner_id,account_id,name,weights) values(auth.uid(),p_account,trim(p_name),p_weights) on conflict(owner_id,account_id,name) do update set weights=excluded.weights returning id into r;
 perform public.plan_finish(p_key,'save_template',req,r);return r;
end $$;
revoke execute on function public.save_allocation_template from public,anon;
grant execute on function public.save_allocation_template to authenticated;
