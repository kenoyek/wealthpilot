import { describe, it, expect } from "vitest";
import { sameOriginPost } from "../lib/request-origin";
import { createHmac } from "node:crypto";
import { securityProof } from "../lib/security-proof";
import {
  deletionReceipt,
  receiptOwner,
  receiptCredentials,
} from "../lib/deletion-receipt";
const secret = "ab".repeat(32),
  owner = "11111111-1111-4111-8111-111111111111",
  nonce = "22222222-2222-4222-8222-222222222222";
describe("account security capabilities", () => {
  it("validates browser origin against the external host without accepting forged or insecure origins", () => {
    expect(
      sameOriginPost(
        "https://wealthpilot-sand.vercel.app",
        "wealthpilot-sand.vercel.app",
      ),
    ).toBe(true);
    expect(sameOriginPost("http://127.0.0.1:3001", "127.0.0.1:3001")).toBe(
      true,
    );
    for (const origin of [
      null,
      "null",
      "https://evil.example",
      "https://evil.example@wealthpilot-sand.vercel.app",
      "http://wealthpilot-sand.vercel.app",
      "https://wealthpilot-sand.vercel.app/path",
    ])
      expect(sameOriginPost(origin, "wealthpilot-sand.vercel.app")).toBe(false);
  });

  it("binds operation, owner, timestamp and nonce to the server key", () => {
    const p = securityProof(owner, "purge", secret, 1000, nonce);
    expect(p.p_signature).toBe(
      createHmac("sha256", Buffer.from(secret, "hex"))
        .update(`purge:${owner}:1000:${nonce}`)
        .digest("hex"),
    );
    expect(
      securityProof(owner, "finish", secret, 1000, nonce).p_signature,
    ).not.toBe(p.p_signature);
    expect(
      securityProof(owner, "purge", secret, 1001, nonce).p_signature,
    ).not.toBe(p.p_signature);
    expect(() => securityProof(owner, "purge", "short")).toThrow();
  });
  it("encrypts and authenticates cleanup receipts without exposing the token", () => {
    const r = deletionReceipt(
      owner,
      secret,
      1000,
      "synthetic-sensitive-cleanup-token",
    );
    expect(r).not.toContain("synthetic-sensitive-cleanup-token");
    expect(receiptCredentials(r, secret, 1001)?.token).toBe(
      "synthetic-sensitive-cleanup-token",
    );
    expect(receiptOwner(r, secret, 1001)).toBe(owner);
    expect(receiptOwner(r, secret, 1000 + 86401)).toBeNull();
    expect(receiptOwner(r, secret, 994)).toBeNull();
    expect(
      receiptOwner(
        r.slice(0, 15) + (r[15] === "a" ? "b" : "a") + r.slice(16),
        secret,
        1001,
      ),
    ).toBeNull();
    expect(receiptOwner(r, "cd".repeat(32), 1001)).toBeNull();
    expect(receiptOwner("x".repeat(1000), secret, 1001)).toBeNull();
    expect(receiptOwner("not-a-receipt", secret, 1001)).toBeNull();
  });
});
