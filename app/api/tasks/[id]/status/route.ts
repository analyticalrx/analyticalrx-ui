import { apiError, proxyBackend } from "@/lib/auth/proxy";
import { isTaskId, validateStatusChange } from "@/lib/tasks";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isTaskId(id)) return apiError("Choose a valid task.", 400);
  return proxyBackend(request, `/api/v1/tasks/${id}/status`, validateStatusChange);
}
