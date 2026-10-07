import { proxyBackend } from "@/lib/auth/proxy";
export async function GET(request: Request) { return proxyBackend(request, "/api/v1/me"); }
