import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clearThumbnailCache } from "@/lib/thumbnails/cache";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";

describe("thumbnail cache cleanup", () => {
  it("removes thumbnail files without touching indexed photos or model cache", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "qeo-cache-clear-"));
    const thumbnailDir = join(dataDir, "cache", "thumbnails");
    const modelDir = join(dataDir, "models");
    await mkdir(thumbnailDir, { recursive: true });
    await mkdir(modelDir, { recursive: true });
    await writeFile(join(thumbnailDir, "thumb.img"), "thumb");
    await writeFile(join(modelDir, "model.bin"), "model");

    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const now = Date.now();
    db.prepare(`INSERT INTO drive_nodes(drive_item_id, name, updated_at) VALUES (?, ?, ?)`)
      .run("drive-1", "photo.jpg", now);
    db.prepare(`
      INSERT INTO photos(id, drive_item_id, name, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("photo-1", "drive-1", "photo.jpg", "/photo.jpg", now, now);

    const result = await clearThumbnailCache(dataDir);

    expect(result.removedFiles).toBe(1);
    expect(db.prepare(`SELECT COUNT(*) AS count FROM photos`).get()).toEqual({ count: 1 });
    await expect(readFile(join(modelDir, "model.bin"), "utf8")).resolves.toBe("model");
    db.close();
  });
});
