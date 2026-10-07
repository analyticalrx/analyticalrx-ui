import "server-only";
import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/auth/backend";
import { AuthConfigurationError, UnsupportedRoleError, bearerToken, verifyAccessToken } from "@/lib/auth/session";

const headers = { "Cache-Control": "no-store" };
export function apiError(message: string, status: number) { return NextResponse.json({ error: message }, { status, headers }); }

export async function proxyBackend(request: Request, path: string, validate?: (input: unknown) => unknown) {
  const token = bearerToken(request);
  if (!token) return apiError("Sign in again to continue.", 401);
  try { await verifyAccessToken(token); } catch (error) {
    if (error instanceof AuthConfigurationError) return apiError("Session verification is unavailable. Contact your administrator.", 503);
    if (error instanceof UnsupportedRoleError) return apiError("Your account does not have access to this workspace.", 403);
    return apiError("Your session has expired or is invalid. Sign in again.", 401);
  }
  let body: string | undefined;
  if (validate) {
    try { body = JSON.stringify(validate(await request.json())); }
    catch (error) { return apiError(error instanceof SyntaxError ? "Enter valid task details." : error instanceof Error ? error.message : "Check your task details.", 400); }
  }
  try {
    const response = await fetch(backendUrl(path), {
      method: request.method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const status = [400, 401, 403, 404, 409, 429].includes(response.status) ? response.status : 502;
      const messages: Record<number, string> = {
        400: path === "/api/v1/tasks" && request.method === "POST" ? "Check your details. The assignee must be an active user with task access to this pharmacy." : "Check your task details and selected pharmacy.",
        401: "Your session is no longer available. Sign in again.",
        403: "Your account does not have permission for this action or pharmacy.",
        404: "This task or pharmacy is no longer available to you.",
        409: "This task is already closed. Refresh its details before continuing.",
        429: "Too many requests. Wait a moment and try again.",
        502: request.method === "GET" ? "The task service is unavailable. Try again shortly." : "The change could not be confirmed. Refresh before trying again.",
      };
      return apiError(messages[status], status);
    }
    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch { return apiError(request.method === "GET" ? "Cannot reach the task service. Try again shortly." : "The change could not be confirmed. Refresh before trying again.", 502); }
}
