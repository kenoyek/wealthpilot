import { describe, expect, it } from "vitest";
import { androidAssetLinks } from "../lib/android/asset-links";
const fingerprint = Array(32).fill("AB").join(":");
describe("Android website association", () => {
  it("trusts no Android signing identity until explicitly configured", () => {
    expect(androidAssetLinks(undefined)).toEqual([]);
    expect(androidAssetLinks("  ")).toEqual([]);
  });
  it("publishes only normalized unique release fingerprints for the fixed package", () => {
    const result = androidAssetLinks(
      `${fingerprint.toLowerCase()}, ${fingerprint}`,
    );
    expect(result).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.wealthpilot.app",
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ]);
  });
  it("rejects malformed fingerprints without publishing a partial trusted list", () => {
    for (const invalid of [
      "AB:CD",
      "any",
      fingerprint + ":FF",
      "ZZ" + fingerprint.slice(2),
    ]) {
      expect(() => androidAssetLinks(`${fingerprint},${invalid}`)).toThrow();
    }
  });
});
