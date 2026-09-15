import type { AppDatabase } from "@/lib/db/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPhotoById: vi.fn() }));
vi.mock("@/lib/db/repositories", () => ({ getPhotoById: mocks.getPhotoById }));

import { addPhotoToExistingAlbum, AlbumNotFoundError } from "@/lib/albums/library";
import { GraphRequestError } from "@/lib/graph/client";

const db = {} as AppDatabase;

function livePhoto() {
  return { id: "photo-1", driveItemId: "drive-1", deletedRemoteAt: null };
}

function drive() {
  return {
    listAlbumItemIds: vi.fn<() => Promise<Set<string>>>().mockResolvedValue(new Set()),
    addAlbumItems: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  mocks.getPhotoById.mockReset().mockReturnValue(livePhoto());
});

describe("addPhotoToExistingAlbum", () => {
  it("rejects unknown or deleted local photos before Graph", async () => {
    const graph = drive();
    mocks.getPhotoById.mockReturnValueOnce(null);
    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "missing", "album-1"))
      .rejects.toThrow("Photo is not available");

    mocks.getPhotoById.mockReturnValueOnce({ ...livePhoto(), deletedRemoteAt: Date.now() });
    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "photo-1", "album-1"))
      .rejects.toThrow("Photo is not available");

    expect(graph.listAlbumItemIds).not.toHaveBeenCalled();
    expect(graph.addAlbumItems).not.toHaveBeenCalled();
  });

  it("uses the server-owned drive id and treats existing membership as success", async () => {
    const graph = drive();
    graph.listAlbumItemIds.mockResolvedValue(new Set(["drive-1"]));

    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "photo-1", "album-1"))
      .resolves.toEqual({ added: false });
    expect(mocks.getPhotoById).toHaveBeenCalledWith(db, "photo-1");
    expect(graph.listAlbumItemIds).toHaveBeenCalledWith("album-1");
    expect(graph.addAlbumItems).not.toHaveBeenCalled();
  });

  it("adds a non-member exactly once", async () => {
    const graph = drive();

    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "photo-1", "album-1"))
      .resolves.toEqual({ added: true });
    expect(graph.addAlbumItems).toHaveBeenCalledTimes(1);
    expect(graph.addAlbumItems).toHaveBeenCalledWith("album-1", ["drive-1"]);
  });

  it("maps only lookup itemNotFound to AlbumNotFoundError", async () => {
    const graph = drive();
    graph.listAlbumItemIds.mockRejectedValue(new GraphRequestError(
      404,
      "itemNotFound",
      JSON.stringify({ error: { code: "itemNotFound" } }),
    ));

    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "photo-1", "album-1"))
      .rejects.toBeInstanceOf(AlbumNotFoundError);
    expect(graph.addAlbumItems).not.toHaveBeenCalled();
  });

  it("does not rewrite or retry errors from the final add", async () => {
    const graph = drive();
    const error = new GraphRequestError(404, "itemNotFound", "photo missing");
    graph.addAlbumItems.mockRejectedValue(error);

    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "photo-1", "album-1"))
      .rejects.toBe(error);
    expect(graph.addAlbumItems).toHaveBeenCalledTimes(1);
  });

  it("propagates other lookup errors unchanged", async () => {
    const graph = drive();
    const error = new GraphRequestError(503, "serviceUnavailable", "try later");
    graph.listAlbumItemIds.mockRejectedValue(error);

    await expect(addPhotoToExistingAlbum({ db, drive: graph }, "photo-1", "album-1"))
      .rejects.toBe(error);
  });
});
