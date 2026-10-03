import { NextResponse } from "next/server";

// Role previews no longer issue a separate cookie-based identity.
export async function POST() {
  return NextResponse.json({ error: "Use /login to sign in with your backend account." }, { status: 404 });
}
