import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
function key(secret: string) {
  if (!/^[0-9a-f]{64}$/.test(secret))
    throw new Error("Account security is not configured.");
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update("wealthpilot.deletion-receipt.v1")
    .digest();
}
export function deletionReceipt(
  owner: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
  token = "",
) {
  if (token.length > 2500)
    throw new Error("Cleanup token exceeds the secure receipt budget.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ owner, issued: now, token }), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function receiptCredentials(
  value: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): { owner: string; token: string } | null {
  if (!value || value.length > 3900) return null;
  try {
    const data = Buffer.from(value, "base64url");
    if (data.length < 29) return null;
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(secret),
      data.subarray(0, 12),
    );
    cipher.setAuthTag(data.subarray(12, 28));
    const parsed = JSON.parse(
      Buffer.concat([
        cipher.update(data.subarray(28)),
        cipher.final(),
      ]).toString("utf8"),
    );
    if (
      !/^[0-9a-f-]{36}$/.test(parsed.owner) ||
      !Number.isSafeInteger(parsed.issued) ||
      parsed.issued > now + 5 ||
      now - parsed.issued > 86400 ||
      typeof parsed.token !== "string"
    )
      return null;
    return { owner: parsed.owner, token: parsed.token };
  } catch {
    return null;
  }
}
export function receiptOwner(
  value: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  return receiptCredentials(value, secret, now)?.owner || null;
}
