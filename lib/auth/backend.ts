import "server-only";

export function backendUrl(path: string): URL {
  return new URL(path, process.env.DATA_PLATFORM_API_URL ?? "http://127.0.0.1:8080");
}
