import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthSession } from "@/lib/auth/types";
import { normalizeRoles } from "@/lib/auth/types";

export class AuthConfigurationError extends Error {}
export class UnsupportedRoleError extends Error {}
let remoteKeys: ReturnType<typeof createRemoteJWKSet> | undefined;
let remoteUrl: string | undefined;
function readClaim(payload: JWTPayload, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object" || !(segment in value)) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, payload);
}
export async function verifyAccessToken(token: string): Promise<AuthSession> {
  const jwksUrl = process.env.AUTH_JWKS_URL;
  const options = {
    issuer: process.env.AUTH_JWT_ISSUER ?? process.env.JWT_ISSUER ?? "analyticalrx-api",
    audience: process.env.AUTH_JWT_AUDIENCE ?? process.env.JWT_AUDIENCE ?? "analyticalrx-frontend",
    algorithms: jwksUrl ? ["RS256", "ES256"] : ["HS256", "HS384", "HS512"],
    requiredClaims: ["sub", "exp", "iat"],
  };
  let key: Uint8Array | ReturnType<typeof createRemoteJWKSet>;
  if (jwksUrl) {
    if (!remoteKeys || remoteUrl !== jwksUrl) {
      remoteKeys = createRemoteJWKSet(new URL(jwksUrl));
      remoteUrl = jwksUrl;
    }
    key = remoteKeys;
  } else {
    const secret = process.env.JWT_SIGNING_SECRET ?? process.env.AUTH_JWT_SECRET;
    if (!secret) throw new AuthConfigurationError("JWT verification is not configured");
    const encoding = process.env.AUTH_JWT_SECRET_ENCODING ?? "base64";
    if (encoding !== "base64" && encoding !== "utf8") throw new AuthConfigurationError("Unsupported signing secret encoding");
    key = encoding === "utf8" ? new TextEncoder().encode(secret) : Buffer.from(secret, "base64");
    if (key.length < 32) throw new AuthConfigurationError("Signing key must be at least 32 bytes");
  }
  const { payload } = await jwtVerify(token, key, options);
  if (typeof payload.sub !== "string" || !payload.sub.trim()) throw new Error("Invalid token subject");
  const roles = normalizeRoles(readClaim(payload, process.env.AUTH_ROLE_CLAIM ?? "roles"));
  const role = roles[0];
  if (!role) throw new UnsupportedRoleError("No supported dashboard role");
  const name = readClaim(payload, process.env.AUTH_NAME_CLAIM ?? "display_name");
  const store = readClaim(payload, process.env.AUTH_STORE_CLAIM ?? "store_id");
  const tenant = payload.tenant_id;
  return {
    userId: payload.sub!, displayName: typeof name === "string" && name.trim() ? name : "Signed-in user",
    role, roles, storeId: typeof store === "string" ? store : undefined, expiresAt: payload.exp!,
    tenantId: typeof tenant === "string" || typeof tenant === "number" ? String(tenant) : undefined,
  };
}
export function bearerToken(request: Request): string | null {
  return /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1] ?? null;
}
