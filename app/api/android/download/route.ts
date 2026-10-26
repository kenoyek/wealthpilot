import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { session } from "@/lib/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  await session();
  if (process.env.WEALTHPILOT_ANDROID_APK_AVAILABLE !== "true")
    return new Response("Android package is not available yet.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  try {
    const apk = await readFile(
      join(process.cwd(), "artifacts/wealthpilot-debug.apk"),
    );
    return new Response(apk, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="wealthpilot-test.apk"',
        "Content-Length": String(apk.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Android package is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
