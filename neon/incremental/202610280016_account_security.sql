-- Keep closed identities mapped until the provider identity is removed, but deny old JWTs access.
create or replace function app_private.current_user_id() returns uuid language sql stable security definer set search_path=pg_catalog,app_private,security_private as $$
 select i.id from app_private.identities i where i.subject=auth.user_id() and exists(select 1 from neon_auth."user" n where n.id::text=i.subject and n."emailVerified" is true) and not exists(select 1 from security_private.closed_accounts c where c.owner_id=i.id)
$$;
create or replace function security_private.request_owner_id() returns uuid language sql stable security definer set search_path=pg_catalog,app_private as $$select id from app_private.identities where subject=auth.user_id()$$;
create or replace function security_private.on_workspace_purged(u uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$begin return;end$$;
create or replace function security_private.provider_absent(u uuid) returns boolean language sql stable security definer set search_path=pg_catalog,app_private as $$
 select not exists(select 1 from neon_auth."user" n join app_private.identities i on n.id::text=i.subject where i.id=u)
$$;
create or replace function security_private.remove_identity(u uuid) returns void language sql security definer set search_path=pg_catalog,app_private as $$delete from app_private.identities where id=u$$;
create or replace function public.ensure_application_user() returns uuid language plpgsql security definer set search_path=pg_catalog,app_private as $$
declare subject_id text:=auth.user_id();app_id uuid;
begin
 if subject_id is null or length(subject_id)>500 then raise exception 'Authentication required';end if;
 if not exists(select 1 from neon_auth."user" u where u.id::text=subject_id and u."emailVerified" is true) then raise exception 'Verify your email before opening your workspace';end if;
 select id into app_id from app_private.identities where subject=subject_id;
 if app_id is null then
  insert into app_private.identities(subject) values(subject_id) on conflict(subject) do update set subject=excluded.subject returning id into app_id;
 end if;
 if exists(select 1 from security_private.closed_accounts where owner_id=app_id) then return app_id;end if;
 perform public.initialize_workspace();return app_id;
end $$;
revoke execute on all functions in schema security_private from public,anonymous,authenticated;
