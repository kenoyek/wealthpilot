-- Additive workspace setup; never rewrites ledger records or existing ownership.
alter table public.profiles add column display_name text not null default '' check(length(display_name)<=60);
alter table public.profiles add column initialized_at timestamptz;

create function public.initialize_workspace() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); ready timestamptz;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select initialized_at into ready from public.profiles where id=uid;
 if ready is not null then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 insert into public.profiles(id) values(uid) on conflict(id) do nothing;
 select initialized_at into ready from public.profiles where id=uid for update;
 if ready is not null then return; end if;
 insert into public.categories(owner_id,name,kind,scope) values
 (uid,'Food & groceries','expense','personal'),(uid,'Home & utilities','expense','personal'),
 (uid,'Getting around','expense','personal'),(uid,'Health & wellbeing','expense','personal'),
 (uid,'Leisure & subscriptions','expense','personal'),(uid,'Other spending','expense','personal'),
 (uid,'Salary & wages','income','personal'),(uid,'Freelance income','income','business'),
 (uid,'Business income','income','business'),(uid,'Business expenses','expense','business')
 on conflict(owner_id,name,kind,scope) do nothing;
 update public.profiles set initialized_at=now() where id=uid;
end $$;
revoke execute on function public.initialize_workspace() from public,anon;
grant execute on function public.initialize_workspace() to authenticated;

create function public.complete_onboarding(p_name text,p_currency text,p_timezone text,p_account text default '',p_opening text default '0',p_date date default current_date)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); done boolean;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if length(trim(p_name)) not between 1 and 60 then raise exception 'Enter your name (up to 60 characters)'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 perform public.initialize_workspace();
 select onboarded into done from public.profiles where id=uid for update;
 if done then return; end if;
 if trim(p_account)<>'' then perform public.create_account(p_account,p_currency,'personal',p_opening,p_date);
 elsif p_opening<>'0' then raise exception 'Enter an account name for its opening balance'; end if;
 update public.profiles set display_name=trim(p_name),currency=p_currency,timezone=p_timezone,onboarded=true where id=uid;
end $$;
revoke execute on function public.complete_onboarding(text,text,text,text,text,date) from public,anon;
grant execute on function public.complete_onboarding(text,text,text,text,text,date) to authenticated;

-- One network round trip for all of the current user's account positions.
create function public.planning_positions() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select coalesce(jsonb_object_agg(a.id::text,public.planning_position(a.id)),'{}'::jsonb)
 from public.accounts a where a.owner_id=auth.uid()
$$;
revoke execute on function public.planning_positions() from public,anon;
grant execute on function public.planning_positions() to authenticated;
