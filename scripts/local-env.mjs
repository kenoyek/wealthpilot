import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
const binary = process.env.SUPABASE_CLI_BINARY_OVERRIDE || "./.tools/supabase";
const status = JSON.parse(
  execFileSync(binary, ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (!status.API_URL || !status.ANON_KEY)
  throw new Error("Local Supabase is not ready.");
if (existsSync(".env.local") && !process.argv.includes("--replace"))
  throw new Error(
    ".env.local exists. Use --replace only if it is a disposable local configuration.",
  );
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\n`,
  { mode: 0o600 },
);
console.log(
  "Local Supabase bindings written to ignored .env.local; no credentials printed.",
);
