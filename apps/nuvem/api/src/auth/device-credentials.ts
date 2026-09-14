import { createHash, randomBytes } from "node:crypto";

export function refreshHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newRefreshCredential() {
  const refreshToken = randomBytes(32).toString("base64url");
  return { refreshToken, hash: refreshHash(refreshToken) };
}
