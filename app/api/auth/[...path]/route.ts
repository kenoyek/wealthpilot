import { neonAuth, neonConfigured } from "@/lib/backend/neon-auth";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  if (!neonConfigured())
    return new Response("Authentication is not configured.", { status: 503 });
  const { path } = await context.params;
  // Credential and account mutations use authenticated, validated server actions.
  const route = path.join("/");
  const allowed =
    request.method === "GET"
      ? ["get-session", "jwks"]
      : ["sign-out", "get-access-token", "refresh-token"];
  if (!allowed.includes(route))
    return new Response("Use the account forms on WealthPilot.", {
      status: 403,
    });
  const handlers = neonAuth().handler();
  return request.method === "GET"
    ? handlers.GET(request, context)
    : handlers.POST(request, context);
}
export const GET = handle;
export const POST = handle;
