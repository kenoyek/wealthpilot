import { test, expect } from "@playwright/test";
test("mobile installation metadata and private Android download boundary", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/install");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(
    page.getByRole("heading", { name: "Keep your money close." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (process.env.WEALTHPILOT_ANDROID_APK_AVAILABLE === "true") {
    await expect(
      page.getByText(/Android test build 1\.0\.1-test/),
    ).toBeVisible();
  }
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "WealthPilot",
    display: "standalone",
    scope: "/",
    start_url: "/dashboard",
  });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  expect(
    await (await request.get("/.well-known/assetlinks.json")).json(),
  ).toEqual([]);
  const download = await request.get("/api/android/download", {
    maxRedirects: 0,
  });
  expect([303, 307]).toContain(download.status());
  expect(download.headers().location).toContain("/login");
});
