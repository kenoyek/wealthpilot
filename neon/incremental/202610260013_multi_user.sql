-- Apply after shared migration 012. Preserves every existing identity UUID.
alter table app_private.identities drop column if exists single_owner;
create table if not exists app_private.schema_migrations(version text primary key,applied_at timestamptz not null default now());
revoke all on app_private.schema_migrations from public,anonymous,authenticated;

create or replace function public.ensure_application_user() returns uuid language plpgsql security definer set search_path=pg_catalog,app_private as $$
declare subject_id text:=auth.user_id(); app_id uuid;
begin
 if subject_id is null or length(subject_id)>500 then raise exception 'Authentication required'; end if;
 -- The native JWT subject must exist in the provider's verified user registry.
 -- Caller-supplied emails, owner IDs and profile fields cannot provision identities.
 if not exists(select 1 from neon_auth."user" u where u.id::text=subject_id and u."emailVerified" is true) then
  raise exception 'Verify your email before opening your workspace';
 end if;
 select id into app_id from app_private.identities where subject=subject_id;
 if app_id is null then
  insert into app_private.identities(subject) values(subject_id)
   on conflict(subject) do update set subject=excluded.subject returning id into app_id;
 end if;
 perform public.initialize_workspace();
 return app_id;
end $$;
revoke execute on function public.ensure_application_user() from public,anonymous;
grant execute on function public.ensure_application_user() to authenticated;
drop function if exists app_private.bind_owner(text);
insert into app_private.schema_migrations(version) values('202610260013_multi_user') on conflict do nothing;
