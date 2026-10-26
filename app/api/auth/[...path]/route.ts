import { neonAuth, neonConfigured } from "@/lib/backend/neon-auth";
import { privateRelease } from "@/lib/release-policy";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  if (!neonConfigured())
    return new Response("Authentication is not configured.", { status: 503 });
  const { path } = await context.params;
  if (path[0] === "admin" || (privateRelease() && path[0] === "sign-up"))
    return new Response("Owner invitation required.", { status: 403 });
  const handlers = neonAuth().handler();
  return request.method === "GET"
    ? handlers.GET(request, context)
    : handlers.POST(request, context);
}
export const GET = handle;
export const POST = handle;
