import { apiError, proxyBackend } from "@/lib/auth/proxy";
import { isTaskId, validateTaskComment } from "@/lib/tasks";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isTaskId(id)) return apiError("Choose a valid task.", 400);
  return proxyBackend(request, `/api/v1/tasks/${id}/comments`);
}
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isTaskId(id)) return apiError("Choose a valid task.", 400);
  return proxyBackend(request, `/api/v1/tasks/${id}/comments`, validateTaskComment);
}
