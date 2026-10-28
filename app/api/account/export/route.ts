import { gzipSync } from "node:zlib";
import { sameOriginPost } from "@/lib/request-origin";
import {
  accountIdentity,
  confirmPassword,
  proof,
} from "@/lib/account-security";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!sameOriginPost(origin, request.headers.get("host")))
    return new Response("Same-origin request required.", { status: 403 });
  const identity = await accountIdentity();
  if (identity.user.closed)
    return new Response("Account is closed.", { status: 409 });
  try {
    const f = await request.formData();
    await confirmPassword(String(f.get("currentPassword") || ""), identity);
    const r = await identity.client.rpc(
      "export_my_workspace",
      proof(identity.user.id, "export"),
    );
    if (r.error || typeof r.data !== "string")
      throw new Error("Export unavailable.");
    const json =
      '{"account":' +
      JSON.stringify({
        email: identity.user.email,
        email_verified: !!(
          identity.user.email_verified || identity.user.email_confirmed_at
        ),
      }) +
      ',"workspace":' +
      r.data +
      "}";
    const compressed =
      f.get("format") === "gzip" || Buffer.byteLength(json) > 2_000_000;
    const body = compressed ? gzipSync(json) : Buffer.from(json);
    if (body.length > 4_000_000)
      return new Response(
        "This export exceeds the download transport limit even after compression. No records were omitted; contact support for a larger transfer.",
        { status: 413, headers: { "Cache-Control": "private, no-store" } },
      );
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": compressed
          ? "application/gzip"
          : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="wealthpilot-complete-${new Date().toISOString().slice(0, 10)}.json${compressed ? ".gz" : ""}"`,
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.redirect(
      new URL(
        "/settings?error=Export%20could%20not%20finish.%20Check%20your%20current%20password%20or%20try%20again%20in%2015%20minutes.#data",
        origin!,
      ),
      303,
    );
  }
}
