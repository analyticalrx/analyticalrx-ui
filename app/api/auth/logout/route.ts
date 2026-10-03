import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/auth/backend";
import { bearerToken, verifyAccessToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  const token = bearerToken(request);
  try {
    if (!token) throw new Error("Missing token");
    await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(backendUrl("/api/v1/auth/logout"), {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      signal: AbortSignal.timeout(5_000), redirect: "error",
    });
    return NextResponse.json({ signedOut: response.ok }, { status: response.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ signedOut: false }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
