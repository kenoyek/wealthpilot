import { describe, it, expect } from "vitest";
import { BurstGuard } from "../lib/auth-burst";
describe("authentication burst backstop", () => {
  it("rejects a burst, keeps other identities independent and resets after expiry", () => {
    const guard = new BurstGuard(2, 100, 10);
    expect(guard.allow("one", 0)).toBe(true);
    expect(guard.allow("one", 10)).toBe(true);
    expect(guard.allow("one", 20)).toBe(false);
    expect(guard.allow("two", 20)).toBe(true);
    expect(guard.allow("one", 100)).toBe(true);
  });
  it("bounds memory instead of evicting an active limit under key flooding", () => {
    const guard = new BurstGuard(2, 100, 1);
    expect(guard.allow("one", 0)).toBe(true);
    expect(guard.allow("two", 1)).toBe(false);
    expect(guard.allow("two", 100)).toBe(true);
  });
});
