-- Protected application capabilities; no key is shipped in source or exposed to API roles.
create schema security_private;
revoke all on schema security_private from public,anon,authenticated;
create table security_private.config(singleton boolean primary key default true check(singleton),secret bytea not null check(octet_length(secret)=32));
create table security_private.closed_accounts(owner_id uuid primary key,closed_at timestamptz not null default now());
create table security_private.used_capabilities(nonce uuid primary key,expires_at timestamptz not null);
create table security_private.attempts(owner_id uuid not null,window_start timestamptz not null,attempts integer not null,primary key(owner_id,window_start));
revoke all on all tables in schema security_private from public,anon,authenticated;
create function security_private.request_owner_id() returns uuid language sql stable security definer set search_path=pg_catalog,public as $$select auth.uid()$$;
create function public.account_state() returns jsonb language sql stable security definer set search_path=pg_catalog,security_private as $$
 select jsonb_build_object('id',security_private.request_owner_id(),'closed',exists(select 1 from security_private.closed_accounts where owner_id=security_private.request_owner_id()))
$$;
create function public.security_attempt() returns boolean language plpgsql security definer set search_path=pg_catalog,security_private as $$
declare u uuid:=security_private.request_owner_id();w timestamptz:=to_timestamp(floor(extract(epoch from clock_timestamp())/900)*900);n integer;
begin
 if u is null then raise exception 'Authentication required';end if;
 delete from security_private.attempts where window_start<clock_timestamp()-interval '1 day';
 insert into security_private.attempts values(u,w,1) on conflict(owner_id,window_start) do update set attempts=least(6,security_private.attempts.attempts+1) returning attempts into n;
 return n<=5;
end $$;
create function security_private.hmac_sha256(message text) returns bytea language plpgsql stable security definer set search_path=pg_catalog,security_private as $$
declare k bytea;inner_pad bytea:=decode(repeat('00',64),'hex');outer_pad bytea:=decode(repeat('00',64),'hex');b integer;
begin
 select secret into k from security_private.config where singleton;
 if k is null then raise exception 'Account security is not configured';end if;
 for i in 0..63 loop
  b:=case when i<32 then get_byte(k,i) else 0 end;
  inner_pad:=set_byte(inner_pad,i,b # 54);outer_pad:=set_byte(outer_pad,i,b # 92);
 end loop;
 return sha256(outer_pad||sha256(inner_pad||convert_to(message,'UTF8')));
end $$;
create function security_private.consume_capability(u uuid,purpose text,issued bigint,nonce uuid,signature text) returns void language plpgsql security definer set search_path=pg_catalog,security_private as $$
declare expected bytea;
begin
 if u is null or nonce is null or issued is null or issued<extract(epoch from clock_timestamp())-120 or issued>extract(epoch from clock_timestamp())+5 or signature is null or signature !~ '^[0-9a-f]{64}$' then raise exception 'Security confirmation expired; retry with your current password';end if;
 expected:=security_private.hmac_sha256(purpose||':'||u::text||':'||issued::text||':'||nonce::text);
 if sha256(decode(signature,'hex'))<>sha256(expected) then raise exception 'Invalid security confirmation';end if;
 delete from security_private.used_capabilities where expires_at<clock_timestamp();
 insert into security_private.used_capabilities values(nonce,to_timestamp(issued)+interval '125 seconds');
end $$;
create function security_private.on_workspace_purged(u uuid) returns void language sql security definer set search_path=pg_catalog,public as $$delete from auth.users where id=u$$;
create function security_private.provider_absent(u uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$select not exists(select 1 from auth.users where id=u)$$;
create function security_private.remove_identity(u uuid) returns void language sql security definer set search_path=pg_catalog,public as $$delete from auth.users where id=u$$;

create function public.purge_my_workspace(p_owner uuid,p_issued bigint,p_nonce uuid,p_signature text) returns boolean language plpgsql security definer set search_path=pg_catalog,public,security_private as $$
begin
 if security_private.request_owner_id() is distinct from p_owner or p_owner is null then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 perform security_private.consume_capability(p_owner,'purge',p_issued,p_nonce,p_signature);
 insert into security_private.closed_accounts(owner_id) values(p_owner) on conflict do nothing;
 delete from public.import_rows where owner_id=p_owner;
 delete from public.import_batches where owner_id=p_owner;
 delete from public.recurring_occurrences where owner_id=p_owner;
 delete from public.recurring_templates where owner_id=p_owner;
 delete from public.allocation_templates where owner_id=p_owner;
 delete from public.goal_events where owner_id=p_owner;
 delete from public.commitment_payments where owner_id=p_owner;
 delete from public.commitment_prices where owner_id=p_owner;
 delete from public.debt_payments where owner_id=p_owner;
 delete from public.commitments where owner_id=p_owner;
 delete from public.debts where owner_id=p_owner;
 delete from public.goals where owner_id=p_owner;
 delete from public.allocation_batches where owner_id=p_owner;
 delete from public.audit_logs where owner_id=p_owner;
 delete from public.lines where owner_id=p_owner;
 -- Related-entry foreign keys are checked at statement end, so remove the owner's journal together.
 delete from public.entries where owner_id=p_owner;
 delete from public.budgets where owner_id=p_owner;
 delete from public.categories where owner_id=p_owner;
 delete from public.accounts where owner_id=p_owner;
 delete from public.planning_audit where owner_id=p_owner;
 delete from public.planning_requests where owner_id=p_owner;
 delete from public.profiles where id=p_owner;
 perform security_private.on_workspace_purged(p_owner);
 return true;
end $$;
create function public.finish_account_deletion(p_owner uuid,p_issued bigint,p_nonce uuid,p_signature text) returns boolean language plpgsql security definer set search_path=pg_catalog,security_private as $$
begin
 perform security_private.consume_capability(p_owner,'finish',p_issued,p_nonce,p_signature);
 if not exists(select 1 from security_private.closed_accounts where owner_id=p_owner) then return true;end if;
 if not security_private.provider_absent(p_owner) then raise exception 'Sign-in identity is still active; retry identity deletion';end if;
 perform security_private.remove_identity(p_owner);
 delete from security_private.attempts where owner_id=p_owner;
 delete from security_private.closed_accounts where owner_id=p_owner;
 return true;
end $$;

-- One stable database statement snapshot, including all records, not PostgREST's row-limited pages.
-- Decimal and bigint columns become JSON strings to preserve precision for downstream readers.
create function security_private.export_my_workspace() returns text language plpgsql stable security definer set search_path=pg_catalog,public,security_private as $$
declare u uuid:=security_private.request_owner_id();table_name text;overrides text;expression text;records jsonb;tables jsonb:='{}';counts jsonb:='{}';
begin
 if u is null or exists(select 1 from security_private.closed_accounts where owner_id=u) then raise exception 'Account unavailable';end if;
 foreach table_name in array array['profiles','accounts','categories','entries','lines','budgets','audit_logs','planning_requests','goals','goal_events','commitments','commitment_prices','commitment_payments','debts','debt_payments','allocation_batches','planning_audit','allocation_templates','recurring_templates','recurring_occurrences','import_batches','import_rows'] loop
  select string_agg(format('%L,to_jsonb(t.%I::text)',a.attname,a.attname),',') into overrides
   from pg_attribute a where a.attrelid=format('public.%I',table_name)::regclass and a.attnum>0 and not a.attisdropped and a.atttypid in ('numeric'::regtype,'int8'::regtype);
  expression:='to_jsonb(t)'||case when overrides is null then '' else '||jsonb_build_object('||overrides||')' end;
  execute format('select coalesce(jsonb_agg(%s),''[]''::jsonb) from public.%I t where %I=$1',expression,table_name,case when table_name='profiles' then 'id' else 'owner_id' end) into records using u;
  tables:=tables||jsonb_build_object(table_name,records);counts:=counts||jsonb_build_object(table_name,jsonb_array_length(records));
 end loop;
 return jsonb_build_object('format','wealthpilot-workspace','version',1,'generated_at',statement_timestamp(),'tables',tables,'record_counts',counts)::text;
end $$;
create function public.export_my_workspace(p_owner uuid,p_issued bigint,p_nonce uuid,p_signature text) returns text language plpgsql security definer set search_path=pg_catalog,security_private as $$
begin
 if p_owner is null or security_private.request_owner_id() is distinct from p_owner then raise exception 'Account unavailable';end if;
 perform security_private.consume_capability(p_owner,'export',p_issued,p_nonce,p_signature);
 return security_private.export_my_workspace();
end $$;
revoke execute on all functions in schema security_private from public,anon,authenticated;
revoke execute on function public.account_state,public.security_attempt,public.export_my_workspace,public.purge_my_workspace,public.finish_account_deletion from public,anon;
grant execute on function public.account_state,public.security_attempt,public.export_my_workspace,public.purge_my_workspace to authenticated;
-- Finalization requires a server signature AND an already-removed provider identity, not a browser claim.
grant execute on function public.finish_account_deletion to authenticated;
