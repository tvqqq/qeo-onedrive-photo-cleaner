import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { DEMO_MODE: false },
  listAlbumsCached: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/albums/catalog", () => ({ listAlbumsCached: mocks.listAlbumsCached }));
vi.mock("@/lib/auth/msal", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/graph/client", () => ({ GraphClient: class GraphClient {} }));
vi.mock("@/lib/graph/drive", () => ({ DriveApi: class DriveApi {} }));

import { GET } from "@/app/api/albums/route";

beforeEach(() => {
  mocks.env.DEMO_MODE = false;
  mocks.listAlbumsCached.mockReset().mockResolvedValue([
    { id: "album-1", name: "Family" },
    { id: "album-2", name: "Travel" },
  ]);
});

describe("GET /api/albums", () => {
  it("returns only the server-side existing album catalog", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ albums: [
      { id: "album-1", name: "Family" },
      { id: "album-2", name: "Travel" },
    ] });
    expect(mocks.listAlbumsCached).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list in demo mode without touching Graph", async () => {
    mocks.env.DEMO_MODE = true;

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ albums: [] });
    expect(mocks.listAlbumsCached).not.toHaveBeenCalled();
  });

  it("redacts token-shaped values from upstream errors", async () => {
    mocks.listAlbumsCached.mockRejectedValue(new Error("Graph failed with abc.def.ghi"));

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Graph failed with [REDACTED]" });
  });
});
