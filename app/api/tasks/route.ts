import { apiError, proxyBackend } from "@/lib/auth/proxy";
import { isTaskStatus, validateCreateTask } from "@/lib/tasks";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const status = query.get("status"), pharmacyKey = query.get("pharmacyKey");
  if (status && !isTaskStatus(status)) return apiError("Choose a valid task status.", 400);
  const filters = new URLSearchParams();
  if (status) filters.set("status", status);
  if (pharmacyKey) filters.set("pharmacyKey", pharmacyKey);
  return proxyBackend(request, `/api/v1/tasks${filters.size ? `?${filters}` : ""}`);
}
export async function POST(request: Request) { return proxyBackend(request, "/api/v1/tasks", validateCreateTask); }
