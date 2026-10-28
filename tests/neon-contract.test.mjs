import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { renderNeonMigrations } from "../scripts/render-neon-migrations.mjs";
const database =
  "wealthpilot_neon_contract_" + randomUUID().replaceAll("-", "").slice(0, 12);
const container = "supabase_db_wealthpilot";
function command(args, input) {
  return execFileSync("docker", ["exec", "-i", container, ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}
function sql(s) {
  return command(
    ["psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"],
    s,
  );
}
test("Neon SQL compatibility contract on an isolated local database", async (t) => {
  command(["createdb", "-U", "postgres", database]);
  try {
    // A fixture for Neon's verified JWT-sub accessor, not a hosted JWT validation test.
    sql(
      `create schema auth;create function auth.user_id() returns text language sql stable as $$select nullif(current_setting('test.neon_subject',true),'')$$;grant usage on schema auth to authenticated;do $$begin if not exists(select 1 from pg_roles where rolname='anonymous') then create role anonymous nologin;end if;end $$;grant anonymous to postgres;create schema neon_auth;create table neon_auth."user"(id text primary key,"emailVerified" boolean not null);insert into neon_auth."user" values('verified-neon-owner-subject',true),('second-user',true),('unverified-user',false);`,
    );
    await t.test(
      "all rendered financial migrations apply without Supabase Auth schema",
      () => sql(renderNeonMigrations()),
    );
    await t.test(
      "owner subject maps to an internal UUID and preserves exact financial postings",
      () =>
        sql(`
   set test.neon_subject='verified-neon-owner-subject';select set_config('test.expected_id',public.ensure_application_user()::text,false);
   set role authenticated;set test.neon_subject='verified-neon-owner-subject';
   do $$declare aid uuid;gid uuid;c uuid;begin
    if public.ensure_application_user()<>current_setting('test.expected_id')::uuid then raise exception 'Owner mapping failed';end if;
    aid:=public.create_account('Neon contract fixture','NGN','personal','1000');
    insert into public.categories(owner_id,name,kind,scope) values(app_private.current_user_id(),'Expense','expense','personal') returning id into c;
    perform public.post_entry(gen_random_uuid(),'expense',aid,'0.10',current_date,'Fixture',c);
    perform public.post_entry(gen_random_uuid(),'expense',aid,'0.20',current_date,'Fixture',c);
    if (select balance::numeric from public.account_balances where id=aid)<>999.70 then raise exception 'Decimal accounting failed';end if;
    gid:=public.save_goal(gen_random_uuid(),jsonb_build_object('account',aid::text,'name','Reserve','kind','goal','target','100','date',(current_date+365)::text,'priority',1));
    perform public.fund_goal(gen_random_uuid(),gid,'50');
    if (public.planning_position(aid)->>'reserved')::numeric<>50 then raise exception 'Earmark accounting failed';end if;
   end $$;reset role;
  `),
    );
    await t.test(
      "unknown subjects cannot bootstrap identities or access other records",
      () =>
        sql(`
   set role authenticated;set test.neon_subject='different-subject';
   do $$declare denied boolean:=false;begin
    if exists(select 1 from public.accounts) or exists(select 1 from public.goal_values) then raise exception 'Cross-user financial leak';end if;
    begin perform public.ensure_application_user();exception when others then denied:=true;end;
    if not denied then raise exception 'Unbound subject was accepted';end if;
    denied:=false;begin perform public.create_account('Forbidden','NGN','personal');exception when others then denied:=true;end;
    if not denied then raise exception 'Unbound user created an account';end if;
    denied:=false;begin perform 1 from app_private.identities;exception when insufficient_privilege then denied:=true;end;
    if not denied then raise exception 'Identity registry was exposed';end if;
   end $$;reset role;
  `),
    );
    await t.test(
      "second verified user provisions once and cannot read or mutate another user's records",
      () =>
        sql(`
      select set_config('test.expected_id',(select id::text from app_private.identities where subject='verified-neon-owner-subject'),false);
      select set_config('test.foreign_account',(select id::text from public.accounts limit 1),false);
      set test.neon_subject='second-user';set role authenticated;
      do $$declare mine uuid; aid uuid; foreign_id uuid; denied boolean:=false;begin
        mine:=public.ensure_application_user();
        if mine::text=current_setting('test.expected_id') then raise exception 'Identity collision';end if;
        if public.ensure_application_user()<>mine then raise exception 'Unstable identity';end if;
        if exists(select 1 from public.accounts) or exists(select 1 from public.goal_values) or exists(select 1 from public.audit_logs) then raise exception 'Cross-user read leak';end if;
        if (select count(*) from public.categories)<>10 then raise exception 'Defaults not idempotent';end if;
        aid:=public.create_account('Second user account','NGN','personal');
        if (select count(*) from jsonb_object_keys(public.planning_positions()))<>1 then raise exception 'Bulk positions leak';end if;
        begin perform public.post_entry(gen_random_uuid(),'expense',current_setting('test.foreign_account')::uuid,'10',current_date);exception when others then denied:=true;end;
        if not denied then raise exception 'Cross-user write accepted';end if;
        denied:=false;
        begin insert into public.categories(owner_id,name,kind,scope) values(current_setting('test.expected_id')::uuid,'Intrusion','expense','personal');exception when insufficient_privilege then denied:=true;end;
        if not denied then raise exception 'Forged owner accepted';end if;
        perform public.complete_onboarding('Second','NGN','Africa/Lagos','First bank','50');
        perform public.complete_onboarding('Second','NGN','Africa/Lagos','Duplicate bank','50');
        if (select count(*) from public.accounts)<>2 then raise exception 'Onboarding duplicated account';end if;
      end$$;reset role;
    `),
    );
    await t.test(
      "unverified provider identity cannot provision a workspace",
      () =>
        sql(`
      set test.neon_subject='unverified-user';set role authenticated;
      do $$declare denied boolean:=false;begin
        begin perform public.ensure_application_user();exception when others then denied:=true;end;
        if not denied then raise exception 'Unverified identity accepted';end if;
        if exists(select 1 from public.accounts) then raise exception 'Unverified data leak';end if;
      end$$;reset role;
    `),
    );
    await t.test(
      "Neon recurring and import RPCs preserve exact balances and duplicate protection",
      () =>
        sql(`
      set test.neon_subject='verified-neon-owner-subject';set role authenticated;
      do $$declare aid uuid;c uuid;sid uuid;rev uuid;k uuid:=gen_random_uuid();payload jsonb;result jsonb;batch uuid;begin
        aid:=public.create_account('Everyday Neon fixture','NGN','personal','100');
        select id into c from public.categories where kind='expense' and scope='personal' limit 1;
        sid:=public.save_recurring(gen_random_uuid(),jsonb_build_object('account',aid,'category',c,'name','Neon schedule','kind','expense','amount','0.10','cadence','monthly','date','2024-01-31'));
        select revision into rev from public.recurring_templates where id=sid;
        perform public.resolve_recurring(k,sid,rev,'2024-01-31',(now() at time zone 'Africa/Lagos')::date);
        perform public.resolve_recurring(k,sid,rev,'2024-01-31',(now() at time zone 'Africa/Lagos')::date);
        if (select next_due from public.recurring_templates where id=sid)<>'2024-02-29'::date then raise exception 'Neon recurrence anchor failed';end if;
        payload:=jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Africa/Lagos')::date,'kind','expense','amount','0.20','description','Native import','reference','native-ref','category',c));
        result:=public.import_transactions(gen_random_uuid(),aid,payload,false);
        if (result->>'imported')::integer<>1 then raise exception 'Native import failed';end if;
        result:=public.import_transactions(gen_random_uuid(),aid,payload,false);
        if (result->>'skipped')::integer<>1 then raise exception 'Native dedupe failed';end if;
        if (select balance::numeric from public.account_balances where id=aid)<>99.70 then raise exception 'Native cash reconciliation failed';end if;
        select id into batch from public.import_batches where account_id=aid and imported=1;
        perform public.undo_import(gen_random_uuid(),batch,(now() at time zone 'Africa/Lagos')::date);
        if (select balance::numeric from public.account_balances where id=aid)<>99.90 then raise exception 'Native undo failed';end if;
      end$$;reset role;
      set test.neon_subject='second-user';set role authenticated;
      do $$begin
        if exists(select 1 from public.recurring_values) or exists(select 1 from public.import_rows) or exists(select 1 from public.import_batches) or exists(select 1 from public.recurring_occurrences) then raise exception 'Native everyday isolation failed';end if;
      end$$;reset role;
    `),
    );
    await t.test(
      "anonymous role cannot read financial data or call financial RPCs",
      () =>
        sql(`
   set role anonymous;
   do $$declare denied boolean:=false;begin
    begin perform 1 from public.accounts;exception when insufficient_privilege then denied:=true;end;
    if not denied then raise exception 'Anonymous financial access';end if;
    denied:=false;begin perform public.ensure_application_user();exception when insufficient_privilege then denied:=true;end;
    if not denied then raise exception 'Anonymous identity RPC access';end if;
   end $$;reset role;
  `),
    );
  } finally {
    command(["dropdb", "-U", "postgres", "--force", database]);
  }
});
