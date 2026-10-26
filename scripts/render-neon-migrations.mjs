import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function renderNeonMigrations() {
  const files = readdirSync(resolve(root, "supabase/migrations"))
    .filter((p) => p.endsWith(".sql"))
    .sort();
  const blocks = files.map((file) => {
    const original = readFileSync(
      resolve(root, "supabase/migrations", file),
      "utf8",
    );
    const sql = original
      .replace(/\bauth\.users\b/g, "app_private.identities")
      .replace(/\bauth\.uid\(\)/g, "app_private.current_user_id()")
      .replace(/\banon\b/g, "anonymous");
    return "-- SOURCE: " + file + "\n" + sql;
  });
  return (
    "-- Fresh dedicated Neon branch. Review before execution. No local test users are copied.\nBEGIN;\n" +
    readFileSync(resolve(root, "neon/bootstrap.sql"), "utf8") +
    "\n" +
    blocks.join("\n") +
    "\nCOMMIT;\n"
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const target = resolve(root, "neon/generated.sql");
  writeFileSync(target, renderNeonMigrations(), { mode: 0o600 });
  console.log(
    "Rendered fresh-branch Neon migration bundle; owner binding is a separate privileged step.",
  );
}
