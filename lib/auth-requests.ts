import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { BurstGuard } from "./auth-burst";
const ipGuard = new BurstGuard(30);
const emailGuard = new BurstGuard(10);
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export async function authRequestAllowed(action: string, email: string) {
  const h = await headers();
  const ip = (
    h.get("x-vercel-forwarded-for") ||
    h.get("x-forwarded-for") ||
    "local"
  )
    .split(",")[0]
    .trim();
  return (
    ipGuard.allow(action + digest(ip)) &&
    emailGuard.allow(action + digest(email.trim().toLowerCase()))
  );
}
