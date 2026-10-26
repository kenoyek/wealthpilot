import { spawnSync } from "node:child_process";
const r = spawnSync("./.tools/supabase", process.argv.slice(2), {
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_INTERNAL_IMAGE_REGISTRY:
      process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY || "docker.io",
  },
});
if (r.error) {
  console.error("Run npm run tools:install first.");
  process.exit(1);
}
process.exit(r.status ?? 1);
