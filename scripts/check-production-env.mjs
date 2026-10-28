import { z } from "zod";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
/** @param {Record<string,string|undefined>} env */
export function productionProblems(env) {
  const issues = [];
  const publicMode =
    env.WEALTHPILOT_PUBLIC_SIGNUP === "true" &&
    env.WEALTHPILOT_PRIVATE_RELEASE === "false";
  if (!publicMode && env.WEALTHPILOT_PRIVATE_RELEASE !== "true")
    issues.push(
      "Explicitly configure private release or public verified registration.",
    );
  if (
    !publicMode &&
    !z.email().safeParse(env.WEALTHPILOT_OWNER_EMAIL?.trim()).success
  )
    issues.push("Set a valid WEALTHPILOT_OWNER_EMAIL for private mode.");
  const hosts = [];
  for (const [name, marker, path] of [
    ["NEON_AUTH_BASE_URL", ".neonauth.", "/auth"],
    ["NEON_DATA_API_URL", ".apirest.", "/rest/v1"],
  ]) {
    try {
      const url = new URL(env[name] || "");
      if (
        url.protocol !== "https:" ||
        !/^ep-[a-z0-9-]+\.(neonauth|apirest)\.(?:c-\d+\.)?[a-z0-9-]+\.aws\.neon\.(?:build|tech)$/.test(
          url.hostname,
        ) ||
        !url.hostname.includes(marker) ||
        !url.pathname.endsWith(path) ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        throw new Error();
      hosts.push({
        prefix: url.hostname.split(marker)[0],
        region: url.hostname.split(marker)[1],
        database: url.pathname.slice(0, -path.length),
      });
    } catch {
      issues.push(
        "Set the hosted " +
          name +
          " copied from the same Neon branch. Local and unreviewed custom endpoints are rejected.",
      );
    }
  }
  if (
    hosts.length === 2 &&
    (hosts[0].prefix !== hosts[1].prefix ||
      hosts[0].region !== hosts[1].region ||
      hosts[0].database !== hosts[1].database)
  )
    issues.push(
      "Neon Auth and Data API must target the same endpoint, region and database.",
    );
  if (!env.NEON_AUTH_COOKIE_SECRET || env.NEON_AUTH_COOKIE_SECRET.length < 32)
    issues.push(
      "Set an actual randomly generated Neon Auth cookie secret of at least 32 characters.",
    );
  if (env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    issues.push(
      "Do not configure legacy local Supabase bindings on the Neon production deployment.",
    );
  if (!/^[0-9a-f]{64}$/.test(env.WEALTHPILOT_SECURITY_SECRET || ""))
    issues.push("Configure the server-only account security capability key.");
  return issues;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const issues = productionProblems(process.env);
  if (issues.length) {
    issues.forEach((s) => console.error(s));
    process.exitCode = 1;
  } else
    console.log(
      "Neon configuration checks passed. Hosted authentication and data isolation must be verified.",
    );
}
