import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const path = new URL("../.env.local", import.meta.url);
const contents = readFileSync(path, "utf8"),
  env = parseEnv(contents);
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(
    env.NEXT_PUBLIC_SUPABASE_URL || "",
  )
)
  throw new Error("Security fixture setup requires local Supabase.");
const secret =
  env.WEALTHPILOT_SECURITY_SECRET || randomBytes(32).toString("hex");
if (!/^[0-9a-f]{64}$/.test(secret))
  throw new Error("Invalid local security configuration.");
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_wealthpilot",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
  ],
  {
    input: `insert into security_private.config values(true,decode('${secret}','hex')) on conflict(singleton) do update set secret=excluded.secret;`,
    stdio: ["pipe", "pipe", "pipe"],
  },
);
if (!env.WEALTHPILOT_SECURITY_SECRET)
  writeFileSync(
    path,
    contents.trimEnd() + `\nWEALTHPILOT_SECURITY_SECRET=${secret}\n`,
    { mode: 0o600 },
  );
console.log(
  "Local security capability configured; no credential values printed.",
);
