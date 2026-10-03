import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/auth/backend";
import { AuthConfigurationError, UnsupportedRoleError, verifyAccessToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  let input: unknown;
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Enter your tenant key, email, and password." }, { status: 400, headers });
  }
  const { email, password, tenantKey } = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (typeof tenantKey !== "string" || !tenantKey.trim()) {
    return NextResponse.json({ error: "Enter your tenant key." }, { status: 400, headers });
  }
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400, headers });
  }
  try {
    const response = await fetch(backendUrl("/api/v1/auth/login"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, tenantKey: tenantKey.trim() }), cache: "no-store",
      signal: AbortSignal.timeout(10_000), redirect: "error",
    });
    if (!response.ok) {
      const status = response.status === 401 ? 401 : response.status === 429 ? 429 : response.status === 400 ? 400 : 502;
      const error = status === 401 ? "Invalid email or password." : status === 429
        ? "Too many sign-in attempts. Try again shortly." : status === 400
        ? "Check your tenant key, email, and password." : "The sign-in service is unavailable. Try again shortly.";
      return NextResponse.json({ error }, { status, headers });
    }
    const data = await response.json();
    if (typeof data.accessToken !== "string" || typeof data.tokenType !== "string" || data.tokenType.toLowerCase() !== "bearer") {
      return NextResponse.json({ error: "The sign-in service returned an invalid response." }, { status: 502, headers });
    }
    let user;
    try { user = await verifyAccessToken(data.accessToken); } catch (error) {
      if (error instanceof AuthConfigurationError) {
        return NextResponse.json({ error: "Sign-in verification is not configured." }, { status: 503, headers });
      }
      if (error instanceof UnsupportedRoleError) {
        return NextResponse.json({ error: "Your account does not have a supported dashboard role. Contact your administrator." }, { status: 403, headers });
      }
      return NextResponse.json({ error: "The sign-in token could not be verified. Contact your administrator." }, { status: 502, headers });
    }
    return NextResponse.json({ accessToken: data.accessToken, user }, { headers });
  } catch {
    return NextResponse.json({ error: "Cannot reach the sign-in service. Try again shortly." }, { status: 502, headers });
  }
}
