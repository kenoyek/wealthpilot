#!/usr/bin/env python3
"""Apply the explicit reviewed additive migrations atomically. Never reset a database."""
import argparse, hashlib, json, os, pathlib, sys, urllib.request, urllib.parse, urllib.error
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools/python"))
try:
    import sqlparse
except ImportError:
    raise SystemExit("Install sqlparse==0.5.5 into .tools/python before running this operational helper.") from None
PROJECT = "steep-star-32189891"
BRANCH = "br-flat-sky-b5iwhifi"
SQL_URL = "https://ep-wandering-brook-b52s00yv.c-7.us-east-2.aws.neon.tech/sql"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate", action="store_true", help="Execute the full migration transaction then deliberately roll it back")
    args = parser.parse_args()
    query = urllib.parse.urlencode({"branch_id": BRANCH, "database_name": "neondb", "role_name": "neondb_owner"})
    request = urllib.request.Request("https://console.neon.tech/api/v2/projects/" + PROJECT + "/connection_uri?" + query, headers={"Authorization": "Bearer " + os.environ["NEON_API_KEY"]})
    with urllib.request.urlopen(request, timeout=25) as response: uri = json.load(response)["uri"]
    def sql(payload):
        request = urllib.request.Request(SQL_URL, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Neon-Connection-String": uri, "Neon-Batch-Isolation-Level": "Serializable"})
        with urllib.request.urlopen(request, timeout=60) as response: return json.load(response)
    before = sql({"query":"select id::text,subject from app_private.identities order by subject", "params":[]})["rows"]
    counts_before = sql({"query":"select (select count(*) from public.accounts)::text as accounts,(select count(*) from public.entries)::text as entries,(select count(*) from public.lines)::text as lines", "params":[]})["rows"][0]
    exists = sql({"query":"select to_regclass('app_private.schema_migrations') is not null as present", "params":[]})["rows"][0]["present"]
    history = {}
    if exists:
        # Older fresh-branch bundles have version-only records. Never silently replay one.
        history = {r["version"]: r for r in sql({"query":"select version,to_jsonb(m)->>'checksum' as checksum from app_private.schema_migrations m", "params":[]})["rows"]}
    queries = [{"query":"create table if not exists app_private.schema_migrations(version text primary key,checksum text,applied_at timestamptz not null default now())", "params":[]}, {"query":"alter table app_private.schema_migrations add column if not exists checksum text", "params":[]}, {"query":"revoke all on app_private.schema_migrations from public,anonymous,authenticated", "params":[]}]
    applied = []
    for relative in ["supabase/migrations/202610260012_workspace_experience.sql", "neon/incremental/202610260013_multi_user.sql", "supabase/migrations/202610280014_everyday_money.sql"]:
        file = ROOT / relative
        source = file.read_text()
        digest = hashlib.sha256(source.encode()).hexdigest()
        if file.stem in history:
            if history[file.stem]["checksum"] != digest: raise SystemExit("Applied migration checksum is missing or differs: " + file.stem)
            continue
        if relative.startswith("supabase/"):
            source = source.replace("auth.uid()", "app_private.current_user_id()").replace("auth.users", "app_private.identities")
            import re
            source = re.sub(r"\banon\b", "anonymous", source)
        queries += [{"query":str(statement).strip(), "params":[]} for statement in sqlparse.parse(source) if str(statement).strip()]
        queries.append({"query":"insert into app_private.schema_migrations(version,checksum) values($1,$2) on conflict(version) do update set checksum=excluded.checksum", "params":[file.stem,digest]})
        applied.append(file.stem)
    if args.validate:
        queries.append({"query":"do $$begin raise exception 'WEALTHPILOT_MIGRATION_CHECK_ROLLBACK';end$$", "params":[]})
    try:
        sql({"queries":queries})
        if args.validate: raise SystemExit("Expected validation rollback did not occur")
    except urllib.error.HTTPError as error:
        body = json.loads(error.read())
        if args.validate and body.get("message") == "WEALTHPILOT_MIGRATION_CHECK_ROLLBACK":
            print(json.dumps({"validated":applied,"transaction_rolled_back":True})); return
        print(json.dumps({"message":body.get("message"),"code":body.get("code")}))
        raise SystemExit(1) from None
    after = sql({"query":"select id::text,subject from app_private.identities order by subject", "params":[]})["rows"]
    after_ids = {row["subject"]: row["id"] for row in after}
    if any(after_ids.get(row["subject"]) != row["id"] for row in before): raise SystemExit("Identity preservation check failed; investigate before enabling registration")
    counts_after = sql({"query":"select (select count(*) from public.accounts)::text as accounts,(select count(*) from public.entries)::text as entries,(select count(*) from public.lines)::text as lines", "params":[]})["rows"][0]
    if any(int(counts_after[k]) < int(counts_before[k]) for k in counts_before): raise SystemExit("Financial record preservation check failed; investigate before deployment")
    print(json.dumps({"applied":applied,"existing_identity_uuids_preserved":True,"existing_financial_records_preserved":True}))
if __name__ == "__main__": main()
