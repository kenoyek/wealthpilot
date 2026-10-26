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
      `create schema auth;create function auth.user_id() returns text language sql stable as $$select nullif(current_setting('test.neon_subject',true),'')$$;grant usage on schema auth to authenticated;do $$begin if not exists(select 1 from pg_roles where rolname='anonymous') then create role anonymous nologin;end if;end $$;grant anonymous to postgres;`,
    );
    await t.test(
      "all rendered financial migrations apply without Supabase Auth schema",
      () => sql(renderNeonMigrations()),
    );
    await t.test(
      "owner subject maps to an internal UUID and preserves exact financial postings",
      () =>
        sql(`
   select set_config('test.expected_id',app_private.bind_owner('verified-neon-owner-subject')::text,false);
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
      "unbound subjects cannot bootstrap identities or access owner records",
      () =>
        sql(`
   set role authenticated;set test.neon_subject='different-subject';
   do $$declare denied boolean:=false;begin
    if exists(select 1 from public.accounts) or exists(select 1 from public.goal_values) then raise exception 'Cross-user financial leak';end if;
    begin perform public.ensure_application_user();exception when others then denied:=true;end;
    if not denied then raise exception 'Unbound subject was accepted';end if;
    denied:=false;begin perform public.create_account('Forbidden','NGN','personal');exception when others then denied:=true;end;
    if not denied then raise exception 'Unbound user created an account';end if;
    denied:=false;begin perform app_private.bind_owner('different-subject');exception when insufficient_privilege then denied:=true;end;
    if not denied then raise exception 'Owner binding was exposed';end if;
   end $$;reset role;
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
