import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getThumbnailPath } from "@/lib/thumbnails/cache";

describe("thumbnail cache", () => {
  it("reuses the cached file while etag is unchanged", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "qeo-thumb-"));
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer) };
    const photo = { driveItemId: "photo-1", etag: "v1" };

    const first = await getThumbnailPath(photo, drive, dataDir);
    const second = await getThumbnailPath(photo, drive, dataDir);

    expect(first).toBe(second);
    expect(existsSync(first)).toBe(true);
    expect(drive.getThumbnailContent).toHaveBeenCalledTimes(1);
  });

  it("refetches thumbnail when the remote etag changes", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "qeo-thumb-"));
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(Uint8Array.from([4, 5, 6]).buffer) };

    const first = await getThumbnailPath({ driveItemId: "photo-1", etag: "v1" }, drive, dataDir);
    const second = await getThumbnailPath({ driveItemId: "photo-1", etag: "v2" }, drive, dataDir);

    expect(first).not.toBe(second);
    expect(drive.getThumbnailContent).toHaveBeenCalledTimes(2);
  });
});
