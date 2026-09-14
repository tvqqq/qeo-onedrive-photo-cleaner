import { describe, expect, it, vi } from "vitest";
import { GraphClient } from "@/lib/graph/client";

describe("GraphClient", () => {
  it("retries 429 responses and honors Retry-After", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(Response.json({ value: [] }));
    const sleep = vi.fn(async () => undefined);
    const client = new GraphClient(async () => "access-token", { fetch: fetchMock, sleep });

    const result = await client.json<{ value: unknown[] }>("/me/drive/root/delta");

    expect(result.value).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("never retries ordinary 4xx responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("bad", { status: 400 }));
    const client = new GraphClient(async () => "access-token", { fetch: fetchMock, sleep: async () => undefined });

    await expect(client.json("/me/drive/items/missing")).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks permanent delete endpoints before network I/O", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new GraphClient(async () => "access-token", { fetch: fetchMock, sleep: async () => undefined });

    await expect(
      client.json("/me/drive/items/x/permanentDelete", { method: "POST" }),
    ).rejects.toThrow(/permanent delete is forbidden/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
