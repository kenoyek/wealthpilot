import { androidAssetLinks } from "@/lib/android/asset-links";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    return Response.json(
      androidAssetLinks(process.env.ANDROID_APP_SHA256_CERTIFICATES),
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return Response.json(
      { error: "Android association is not configured correctly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
