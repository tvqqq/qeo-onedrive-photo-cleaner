const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 5;

type TokenProvider = () => Promise<string>;
type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export interface GraphClientOptions {
  fetch?: FetchLike;
  sleep?: Sleep;
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("Retry-After");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(5_000, 250 * 2 ** attempt);
}

function resolveGraphUrl(urlOrPath: string): URL {
  const url = /^https?:\/\//i.test(urlOrPath)
    ? new URL(urlOrPath)
    : new URL(`${GRAPH_BASE_URL}${urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`}`);
  if (url.protocol !== "https:" || url.hostname !== "graph.microsoft.com") {
    throw new Error("Only Microsoft Graph HTTPS URLs are allowed");
  }
  return url;
}

function assertNonDestructivePath(url: URL): void {
  const path = decodeURIComponent(url.pathname).toLowerCase();
  if (path.includes("/permanentdelete") || /\/recyclebin\/items\/[^/]+\/delete(?:\/|$)/.test(path)) {
    throw new Error("Permanent delete is forbidden");
  }
}

export class GraphClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: Sleep;

  constructor(
    private readonly getToken: TokenProvider,
    options: GraphClientOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  private async request(urlOrPath: string, init: RequestInit = {}): Promise<Response> {
    const url = resolveGraphUrl(urlOrPath);
    assertNonDestructivePath(url);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${await this.getToken()}`);
      const response = await this.fetchImpl(url, { ...init, headers });

      if (response.ok) return response;
      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
        const delay = retryDelay(response, attempt);
        await response.body?.cancel().catch(() => undefined);
        await this.sleep(delay);
        continue;
      }

      const body = await response.text().catch(() => "");
      throw new Error(`Microsoft Graph request failed (${response.status})${body ? `: ${body.slice(0, 500)}` : ""}`);
    }

    throw new Error("Microsoft Graph retry limit reached");
  }

  async json<T = unknown>(urlOrPath: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(urlOrPath, init);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async stream(urlOrPath: string, init: RequestInit = {}): Promise<ReadableStream<Uint8Array>> {
    const response = await this.request(urlOrPath, init);
    if (!response.body) throw new Error("Microsoft Graph response has no body");
    return response.body;
  }
}
