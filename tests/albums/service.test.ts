import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { ensureTaxonomy, writeAutomaticCategories } from "@/lib/classification/service";
import { syncCategoryAlbum } from "@/lib/albums/service";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

function setup() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-album-")), "test.db"));
  open.push(db);
  migrateDatabase(db);
  ensureTaxonomy(db);
  const now = Date.now();

  for (const [id, reviewed] of [["1", 1], ["2", 0], ["3", 1]] as const) {
    db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?,?,0,?)")
      .run(`d${id}`, `${id}.jpg`, now);
    db.prepare(`INSERT INTO photos(
      id,drive_item_id,name,path,size_bytes,etag,created_at,updated_at,classification_reviewed
    ) VALUES (?,?,?,?,100,?,?,?,?)`)
      .run(`p${id}`, `d${id}`, `${id}.jpg`, `/Pictures/${id}.jpg`, `e${id}`, now, now, reviewed);
    writeAutomaticCategories(db, `p${id}`, [{ slug: "travel", confidence: 0.8, source: "local-ai" }]);
  }
  db.prepare("UPDATE photos SET deleted_remote_at = ? WHERE id = 'p3'").run(now);
  return db;
}

describe("reviewed category album sync", () => {
  it("creates once and only adds reviewed active members once", async () => {
    const db = setup();
    const drive = {
      createAlbum: vi.fn().mockResolvedValue("bundle-1"),
      addAlbumItems: vi.fn().mockResolvedValue(undefined),
    };

    await expect(syncCategoryAlbum({ db, drive }, "travel")).resolves.toEqual({
      albumId: "bundle-1",
      added: 1,
    });
    expect(drive.createAlbum).toHaveBeenCalledWith("Travel");
    expect(drive.addAlbumItems).toHaveBeenCalledWith("bundle-1", ["d1"]);

    drive.createAlbum.mockClear();
    drive.addAlbumItems.mockClear();
    await expect(syncCategoryAlbum({ db, drive }, "travel")).resolves.toEqual({
      albumId: "bundle-1",
      added: 0,
    });
    expect(drive.createAlbum).not.toHaveBeenCalled();
    expect(drive.addAlbumItems).not.toHaveBeenCalled();
  });
});
