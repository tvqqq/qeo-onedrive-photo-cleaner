import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { close: vi.fn() },
  env: { DEMO_MODE: false },
  enqueueJobIfIdle: vi.fn(),
  applyManualTag: vi.fn(),
  getPhotoById: vi.fn(),
  addPhotoToExistingAlbum: vi.fn(),
  deleteLibraryPhoto: vi.fn(),
  invalidateAlbumCatalog: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ openAppDatabase: () => mocks.db }));
vi.mock("@/lib/db/migrate", () => ({ migrateDatabase: vi.fn() }));
vi.mock("@/lib/db/repositories", () => ({ getPhotoById: mocks.getPhotoById }));
vi.mock("@/lib/jobs/repository", () => ({ enqueueJobIfIdle: mocks.enqueueJobIfIdle }));
vi.mock("@/lib/tags/repository", () => ({ applyManualTag: mocks.applyManualTag }));
vi.mock("@/lib/albums/catalog", () => ({ invalidateAlbumCatalog: mocks.invalidateAlbumCatalog }));
vi.mock("@/lib/albums/library", () => ({
  AlbumNotFoundError: class AlbumNotFoundError extends Error {
    constructor() { super("OneDrive album no longer exists"); }
  },
  addPhotoToExistingAlbum: mocks.addPhotoToExistingAlbum,
}));
vi.mock("@/lib/photos/delete", () => ({ deleteLibraryPhoto: mocks.deleteLibraryPhoto }));
vi.mock("@/lib/auth/msal", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/graph/client", () => ({
  GraphClient: class GraphClient {},
  GraphRequestError: class GraphRequestError extends Error {
    constructor(public status: number, public code: string | null, message: string) { super(message); }
  },
}));
vi.mock("@/lib/graph/drive", () => ({ DriveApi: class DriveApi {} }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

import { POST } from "@/app/api/photos/action/route";

function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/photos/action", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.db.close.mockReset();
  mocks.env.DEMO_MODE = false;
  mocks.enqueueJobIfIdle.mockReset().mockReturnValue("job-tags");
  mocks.applyManualTag.mockReset().mockReturnValue({
    slug: "family",
    name: "Family",
    source: "manual",
    state: "active",
    confidence: null,
  });
  mocks.getPhotoById.mockReset().mockReturnValue({ id: "photo-1", deletedRemoteAt: null });
  mocks.addPhotoToExistingAlbum.mockReset().mockResolvedValue({ added: true });
  mocks.deleteLibraryPhoto.mockReset().mockResolvedValue({ deleted: true });
  mocks.invalidateAlbumCatalog.mockReset();
});

describe("Library photo actions", () => {
  it("deduplicates Generate AI Tags through the shared job helper", async () => {
    const response = await POST(request({ action: "generate-tags" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ jobId: "job-tags" });
    expect(mocks.enqueueJobIfIdle).toHaveBeenCalledWith(mocks.db, "tag-photos", {});
    expect(mocks.db.close).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid tag payloads before manual mutation", async () => {
    const response = await POST(request({
      action: "add-tag",
      photoId: "photo-1",
      tag: "x".repeat(81),
    }));

    expect(response.status).toBe(400);
    expect(mocks.applyManualTag).not.toHaveBeenCalled();
    expect(mocks.db.close).toHaveBeenCalledTimes(1);
  });

  it("requires a live server-side photo before applying manual tags", async () => {
    mocks.getPhotoById.mockReturnValue(null);

    const response = await POST(request({ action: "add-tag", photoId: "photo-1", tag: "Family" }));

    expect(response.status).toBe(400);
    expect(mocks.getPhotoById).toHaveBeenCalledWith(mocks.db, "photo-1");
    expect(mocks.applyManualTag).not.toHaveBeenCalled();
    expect(mocks.db.close).toHaveBeenCalledTimes(1);
  });

  it("rejects a locally deleted photo before applying manual tags", async () => {
    mocks.getPhotoById.mockReturnValue({ id: "photo-1", deletedRemoteAt: Date.now() });

    const response = await POST(request({ action: "remove-tag", photoId: "photo-1", tag: "family" }));

    expect(response.status).toBe(400);
    expect(mocks.applyManualTag).not.toHaveBeenCalled();
  });

  it("passes only server-owned identifiers into album and delete services", async () => {
    const albumResponse = await POST(request({
      action: "add-to-album",
      photoId: "photo-1",
      albumId: "album-1",
      driveItemId: "attacker-drive-id",
      etag: "attacker-etag",
    }));
    expect(albumResponse.status).toBe(200);
    expect(mocks.addPhotoToExistingAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ db: mocks.db, drive: expect.anything() }),
      "photo-1",
      "album-1",
    );

    const deleteResponse = await POST(request({
      action: "delete",
      photoId: "photo-1",
      driveItemId: "attacker-drive-id",
      etag: "attacker-etag",
    }));
    expect(deleteResponse.status).toBe(200);
    expect(mocks.deleteLibraryPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ db: mocks.db, drive: expect.anything(), demoMode: false }),
      "photo-1",
    );
  });

  it("blocks album mutation in demo mode before Graph-backed service execution", async () => {
    mocks.env.DEMO_MODE = true;

    const response = await POST(request({ action: "add-to-album", photoId: "photo-1", albumId: "album-1" }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.addPhotoToExistingAlbum).not.toHaveBeenCalled();
  });

  it("redacts token-shaped values from mutation errors", async () => {
    mocks.deleteLibraryPhoto.mockRejectedValue(new Error("Graph failed with abc.def.ghi"));

    const response = await POST(request({ action: "delete", photoId: "photo-1" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Graph failed with [REDACTED]" });
  });

  it("blocks cross-origin mutation before opening the database", async () => {
    const response = await POST(request({ action: "generate-tags" }, "https://evil.example"));

    expect(response.status).toBe(400);
    expect(mocks.enqueueJobIfIdle).not.toHaveBeenCalled();
    expect(mocks.db.close).not.toHaveBeenCalled();
  });
});
