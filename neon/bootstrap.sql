-- Fresh dedicated Neon branch only. Enable Data API + Managed Better Auth first,
-- with automatic public-schema grants disabled. Does not touch neon_auth tables.
do $$begin
 if to_regprocedure('auth.user_id()') is null or not exists(select 1 from pg_roles where rolname='authenticated') or not exists(select 1 from pg_roles where rolname='anonymous') then raise exception 'Enable Neon Data API and its authentication roles before applying this bundle';end if;
end $$;
create schema app_private;
revoke all on schema app_private from public,anonymous;
grant usage on schema app_private to authenticated;
create table app_private.identities(id uuid primary key default gen_random_uuid(),subject text not null unique,single_owner boolean not null default true unique check(single_owner));
revoke all on app_private.identities from public,anonymous,authenticated;
create function app_private.current_user_id() returns uuid language sql stable security definer set search_path=pg_catalog,app_private as $$select id from app_private.identities where subject=auth.user_id()$$;
revoke execute on function app_private.current_user_id() from public,anonymous;
grant execute on function app_private.current_user_id() to authenticated;
create function app_private.bind_owner(p_subject text) returns uuid language plpgsql set search_path=pg_catalog,app_private as $$
declare found_id uuid;
begin
 if p_subject is null or length(p_subject)<1 or length(p_subject)>500 then raise exception 'Use the verified Neon owner subject';end if;
 select id into found_id from app_private.identities where subject=p_subject;if found then return found_id;end if;
 if exists(select 1 from app_private.identities) then raise exception 'A different owner is already bound; review ownership changes separately';end if;
 insert into app_private.identities(subject) values(p_subject) returning id into found_id;return found_id;
end $$;
revoke execute on function app_private.bind_owner(text) from public,anonymous,authenticated;
create function public.ensure_application_user() returns uuid language plpgsql security definer set search_path=pg_catalog,app_private as $$
declare u uuid:=app_private.current_user_id();
begin
 if u is null then raise exception 'Verified owner identity has not been provisioned';end if;return u;
end $$;
revoke execute on function public.ensure_application_user() from public,anonymous;
grant execute on function public.ensure_application_user() to authenticated;
