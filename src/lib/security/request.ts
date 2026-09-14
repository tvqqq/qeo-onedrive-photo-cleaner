export function assertSameOriginJson(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("Cross-origin mutation blocked: missing origin");

  const requestUrl = new URL(request.url);
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new Error("Cross-origin mutation blocked: invalid origin");
  }

  if (originUrl.host !== requestUrl.host) {
    throw new Error("Cross-origin mutation blocked");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("JSON required");
  }
}
