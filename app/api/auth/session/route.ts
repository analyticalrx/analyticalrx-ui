import { NextResponse } from "next/server";
import { AuthConfigurationError, UnsupportedRoleError, bearerToken, verifyAccessToken } from "@/lib/auth/session";
export async function GET(request: Request) {
  const token = bearerToken(request);
  const headers = { "Cache-Control": "no-store" };
  if (!token) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers });
  try {
    return NextResponse.json({ user: await verifyAccessToken(token) }, { headers });
  } catch (error) {
    const status = error instanceof AuthConfigurationError ? 503 : error instanceof UnsupportedRoleError ? 403 : 401;
    const message = status === 503 ? "Sign-in verification is not configured." : status === 403
      ? "Your account does not have a supported dashboard role. Contact your administrator."
      : "Your session has expired or is invalid. Sign in again.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
