import { createHmac, randomUUID } from "node:crypto";
export function securityProof(
  owner: string,
  purpose: "purge" | "finish" | "export",
  secret: string,
  issued = Math.floor(Date.now() / 1000),
  nonce = randomUUID(),
) {
  if (!/^[0-9a-f]{64}$/.test(secret))
    throw new Error("Account security is not configured.");
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${purpose}:${owner}:${issued}:${nonce}`)
    .digest("hex");
  return {
    p_owner: owner,
    p_issued: issued,
    p_nonce: nonce,
    p_signature: signature,
  };
}
