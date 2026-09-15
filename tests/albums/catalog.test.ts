import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateAlbumCatalog, listAlbumsCached } from "@/lib/albums/catalog";

describe("album catalog cache", () => {
  beforeEach(() => invalidateAlbumCatalog());

  it("caches existing albums for five minutes and returns defensive copies", async () => {
    const drive = {
      listAlbums: vi.fn().mockResolvedValue([{ id: "a1", name: "Family" }]),
    };

    const first = await listAlbumsCached(drive, 1_000);
    first.push({ id: "mutated", name: "Mutated" });
    const second = await listAlbumsCached(drive, 1_000 + 5 * 60 * 1_000 - 1);

    expect(drive.listAlbums).toHaveBeenCalledTimes(1);
    expect(second).toEqual([{ id: "a1", name: "Family" }]);
  });

  it("refreshes at expiry and after explicit invalidation", async () => {
    const drive = {
      listAlbums: vi.fn()
        .mockResolvedValueOnce([{ id: "a1", name: "Family" }])
        .mockResolvedValueOnce([{ id: "a2", name: "Travel" }])
        .mockResolvedValueOnce([{ id: "a3", name: "Work" }]),
    };

    await listAlbumsCached(drive, 10_000);
    await expect(listAlbumsCached(drive, 10_000 + 5 * 60 * 1_000)).resolves.toEqual([
      { id: "a2", name: "Travel" },
    ]);

    invalidateAlbumCatalog();
    await expect(listAlbumsCached(drive, 10_000 + 5 * 60 * 1_000 + 1)).resolves.toEqual([
      { id: "a3", name: "Work" },
    ]);
    expect(drive.listAlbums).toHaveBeenCalledTimes(3);
  });

  it("does not cache a rejected Graph fetch", async () => {
    const drive = {
      listAlbums: vi.fn()
        .mockRejectedValueOnce(new Error("Graph unavailable"))
        .mockResolvedValueOnce([{ id: "a1", name: "Family" }]),
    };

    await expect(listAlbumsCached(drive, 20_000)).rejects.toThrow("Graph unavailable");
    await expect(listAlbumsCached(drive, 20_001)).resolves.toEqual([{ id: "a1", name: "Family" }]);
    expect(drive.listAlbums).toHaveBeenCalledTimes(2);
  });
});
