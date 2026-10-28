import { createNeonAuth } from "@neondatabase/auth/next/server";
export function neonConfigured() {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL &&
    process.env.NEON_DATA_API_URL &&
    process.env.NEON_AUTH_COOKIE_SECRET &&
    process.env.NEON_AUTH_COOKIE_SECRET.length >= 32,
  );
}
export function neonAuth() {
  if (!neonConfigured())
    throw new Error(
      "Neon Auth, Data API and cookie-signing configuration are required.",
    );
  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: {
      secret: process.env.NEON_AUTH_COOKIE_SECRET!,
      sessionDataTtl: 30,
    },
    logLevel: "silent",
  });
}
