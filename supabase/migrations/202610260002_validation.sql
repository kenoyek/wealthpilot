drop function public.create_account(text,text,text,text);
create function public.create_account(p_name text,p_currency text,p_scope text,p_opening text default '0',p_date date default current_date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare aid uuid; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from public.accounts where owner_id=uid)>=100 then raise exception 'Account limit reached'; end if;
 insert into public.accounts(owner_id,name,currency,scope) values(uid,trim(p_name),p_currency,p_scope) returning id into aid;
 if p_opening<>'0' then perform public.post_entry(gen_random_uuid(),'opening',aid,p_opening,p_date,'Opening balance'); end if;
 return aid;
end $$;

revoke execute on function public.create_account from public,anon;
grant execute on function public.create_account to authenticated;
create function public.validate_budget_category() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.categories where id=new.category_id and owner_id=new.owner_id and kind='expense') then raise exception 'Choose an expense category'; end if;
 return new;
end $$;
create trigger budget_expense_category before insert or update on public.budgets for each row execute function public.validate_budget_category();
revoke execute on function public.validate_budget_category from public,anon,authenticated;
