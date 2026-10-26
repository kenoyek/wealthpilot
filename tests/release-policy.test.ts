import { describe, it, expect } from "vitest";
import {
  privateRelease,
  ownerEmailAllowed,
  sessionAllowed,
  ownerSetupAllowed,
} from "../lib/release-policy";
import { productionProblems } from "../scripts/check-production-env.mjs";
const settings = { vercelEnv: "production", ownerEmail: "owner@example.test" };
// Synthetic configuration for pure validation only; no provider requests occur.
const example = {
  WEALTHPILOT_PRIVATE_RELEASE: "true",
  WEALTHPILOT_OWNER_EMAIL: "owner@example.test",
  NEON_AUTH_BASE_URL:
    "https://ep-example.neonauth.c-2.us-east-2.aws.neon.build/neondb/auth",
  NEON_DATA_API_URL:
    "https://ep-example.apirest.c-2.us-east-2.aws.neon.build/neondb/rest/v1",
  NEON_AUTH_COOKIE_SECRET: "synthetic-test-cookie-key-not-for-deployment",
};
describe("private release policy", () => {
  it("allows temporary enrollment only for the configured owner when explicitly enabled", () => {
    expect(
      ownerSetupAllowed("owner@example.test", {
        ...settings,
        ownerSetup: "true",
      }),
    ).toBe(true);
    expect(
      ownerSetupAllowed("other@example.test", {
        ...settings,
        ownerSetup: "true",
      }),
    ).toBe(false);
    expect(ownerSetupAllowed("owner@example.test", settings)).toBe(false);
    expect(
      ownerSetupAllowed("owner@example.test", { ownerSetup: "true" }),
    ).toBe(false);
  });
  it("defaults Vercel production and previews to private, even with an accidental false flag", () => {
    expect(
      privateRelease({ vercelEnv: "production", privateRelease: "false" }),
    ).toBe(true);
    expect(privateRelease({ vercelEnv: "preview" })).toBe(true);
    expect(privateRelease({})).toBe(false);
  });
  it("fails closed without a valid configured owner", () => {
    expect(
      ownerEmailAllowed("owner@example.test", { vercelEnv: "production" }),
    ).toBe(false);
    expect(
      ownerEmailAllowed("owner@example.test", {
        vercelEnv: "production",
        ownerEmail: "invalid",
      }),
    ).toBe(false);
  });
  it("allows only the exact normalized owner address", () => {
    expect(ownerEmailAllowed(" OWNER@EXAMPLE.TEST ", settings)).toBe(true);
    expect(ownerEmailAllowed("other@example.test", settings)).toBe(false);
    expect(ownerEmailAllowed("owner+alias@example.test", settings)).toBe(false);
  });
  it("requires verified email for private sessions", () => {
    expect(sessionAllowed("owner@example.test", true, settings)).toBe(true);
    expect(sessionAllowed("owner@example.test", false, settings)).toBe(false);
    expect(sessionAllowed("other@example.test", true, settings)).toBe(false);
  });
  it("retains isolated local multi-user development unless private mode is requested", () => {
    expect(sessionAllowed("test@example.test", false, {})).toBe(true);
    expect(
      sessionAllowed("test@example.test", true, { privateRelease: "true" }),
    ).toBe(false);
  });
});
describe("Neon deployment configuration checks", () => {
  it("accepts a matching hosted configuration without claiming provider readiness", () =>
    expect(productionProblems(example)).toEqual([]));
  it("accepts matching Neon-managed tech hostnames and rejects lookalikes", () => {
    expect(
      productionProblems({
        ...example,
        NEON_AUTH_BASE_URL: example.NEON_AUTH_BASE_URL.replace(
          ".neon.build",
          ".neon.tech",
        ),
        NEON_DATA_API_URL: example.NEON_DATA_API_URL.replace(
          ".neon.build",
          ".neon.tech",
        ),
      }),
    ).toEqual([]);
    for (const suffix of [
      ".neon.tech.attacker.test",
      ".neonXtech",
      ".neon.tech.",
    ]) {
      expect(
        productionProblems({
          ...example,
          NEON_AUTH_BASE_URL: example.NEON_AUTH_BASE_URL.replace(
            ".neon.build",
            suffix,
          ),
        }).length,
      ).toBeGreaterThan(0);
    }
  });
  it("rejects missing settings and local bindings", () => {
    expect(productionProblems({})).toHaveLength(5);
    expect(
      productionProblems({
        ...example,
        NEON_DATA_API_URL: "http://127.0.0.1:54321/rest/v1",
      }).length,
    ).toBeGreaterThan(0);
  });
  it("rejects different Neon endpoint or database pairings", () => {
    expect(
      productionProblems({
        ...example,
        NEON_DATA_API_URL: example.NEON_DATA_API_URL.replace(
          "ep-example",
          "ep-other",
        ),
      }),
    ).toContain(
      "Neon Auth and Data API must target the same endpoint, region and database.",
    );
    expect(
      productionProblems({
        ...example,
        NEON_DATA_API_URL: example.NEON_DATA_API_URL.replace(
          "/neondb/",
          "/otherdb/",
        ),
      }),
    ).toContain(
      "Neon Auth and Data API must target the same endpoint, region and database.",
    );
  });
  it("rejects insecure URLs, short signing keys and legacy Supabase production configuration", () => {
    expect(
      productionProblems({
        ...example,
        NEON_AUTH_BASE_URL: example.NEON_AUTH_BASE_URL.replace(
          "https:",
          "http:",
        ),
        NEON_AUTH_COOKIE_SECRET: "short",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toHaveLength(3);
  });
});
