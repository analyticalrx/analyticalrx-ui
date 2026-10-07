import { apiError, proxyBackend } from "@/lib/auth/proxy";
import { isTaskId } from "@/lib/tasks";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isTaskId(id)) return apiError("Choose a valid task.", 400);
  return proxyBackend(request, `/api/v1/tasks/${id}`);
}
