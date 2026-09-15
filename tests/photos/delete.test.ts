import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { deleteLibraryPhoto } from "@/lib/photos/delete";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

function setup(etag: string | null = "etag-1") {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-photo-delete-")), "test.db"));
  open.push(db);
  migrateDatabase(db);
  const now = Date.now();
  db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,etag,updated_at) VALUES ('drive-1','one.jpg',0,?,?)")
    .run(etag, now);
  db.prepare(`
    INSERT INTO photos(id,drive_item_id,name,path,size_bytes,etag,created_at,updated_at)
    VALUES ('photo-1','drive-1','one.jpg','/Pictures/one.jpg',100,?,?,?)
  `).run(etag, now, now);
  return db;
}

describe("deleteLibraryPhoto", () => {
  it("rejects demo mode before any Graph call", async () => {
    const db = setup();
    const drive = { getItem: vi.fn(), deleteItem: vi.fn() };

    await expect(deleteLibraryPhoto({ db, drive, demoMode: true }, "photo-1"))
      .rejects.toThrow(/demo/i);
    expect(drive.getItem).not.toHaveBeenCalled();
    expect(drive.deleteItem).not.toHaveBeenCalled();
  });

  it("rejects unknown or already-deleted local photos before Graph", async () => {
    const db = setup();
    const drive = { getItem: vi.fn(), deleteItem: vi.fn() };

    await expect(deleteLibraryPhoto({ db, drive, demoMode: false }, "missing"))
      .rejects.toThrow("Photo is not available");

    db.prepare("UPDATE photos SET deleted_remote_at = ? WHERE id = 'photo-1'").run(Date.now());
    await expect(deleteLibraryPhoto({ db, drive, demoMode: false }, "photo-1"))
      .rejects.toThrow("Photo is not available");

    expect(drive.getItem).not.toHaveBeenCalled();
    expect(drive.deleteItem).not.toHaveBeenCalled();
  });

  it("requires local and remote ETags to exist and match exactly", async () => {
    const missingLocal = setup(null);
    const missingLocalDrive = { getItem: vi.fn(), deleteItem: vi.fn() };
    await expect(deleteLibraryPhoto({ db: missingLocal, drive: missingLocalDrive, demoMode: false }, "photo-1"))
      .rejects.toThrow(/etag/i);
    expect(missingLocalDrive.getItem).not.toHaveBeenCalled();

    const db = setup();
    const missingRemote = { getItem: vi.fn().mockResolvedValue({ id: "drive-1" }), deleteItem: vi.fn() };
    await expect(deleteLibraryPhoto({ db, drive: missingRemote, demoMode: false }, "photo-1"))
      .rejects.toThrow(/etag/i);
    expect(missingRemote.deleteItem).not.toHaveBeenCalled();

    const changed = { getItem: vi.fn().mockResolvedValue({ id: "drive-1", eTag: "etag-2" }), deleteItem: vi.fn() };
    await expect(deleteLibraryPhoto({ db, drive: changed, demoMode: false }, "photo-1"))
      .rejects.toThrow(/changed/i);
    expect(changed.deleteItem).not.toHaveBeenCalled();
  });

  it("moves the matching item to Recycle Bin and records local deletion state", async () => {
    const db = setup();
    const drive = {
      getItem: vi.fn().mockResolvedValue({ id: "drive-1", eTag: "etag-1" }),
      deleteItem: vi.fn().mockResolvedValue(undefined),
    };

    await expect(deleteLibraryPhoto({ db, drive, demoMode: false }, "photo-1"))
      .resolves.toEqual({ deleted: true });

    expect(drive.deleteItem).toHaveBeenCalledTimes(1);
    expect(drive.deleteItem).toHaveBeenCalledWith("drive-1", "etag-1");
    expect(db.prepare("SELECT drive_item_id, previous_etag FROM deletion_log WHERE photo_id = 'photo-1'").get())
      .toEqual({ drive_item_id: "drive-1", previous_etag: "etag-1" });
    const photo = db.prepare("SELECT deleted_remote_at FROM photos WHERE id = 'photo-1'").get() as { deleted_remote_at: number | null };
    const node = db.prepare("SELECT deleted_remote_at FROM drive_nodes WHERE drive_item_id = 'drive-1'").get() as { deleted_remote_at: number | null };
    expect(photo.deleted_remote_at).not.toBeNull();
    expect(node.deleted_remote_at).not.toBeNull();
  });

  it("never retries remote delete when local persistence fails after Graph success", async () => {
    const db = setup();
    db.exec(`
      CREATE TRIGGER fail_deletion_log
      BEFORE INSERT ON deletion_log
      BEGIN
        SELECT RAISE(ABORT, 'forced local failure');
      END;
    `);
    const drive = {
      getItem: vi.fn().mockResolvedValue({ id: "drive-1", eTag: "etag-1" }),
      deleteItem: vi.fn().mockResolvedValue(undefined),
    };

    await expect(deleteLibraryPhoto({ db, drive, demoMode: false }, "photo-1"))
      .rejects.toThrow("forced local failure");
    expect(drive.deleteItem).toHaveBeenCalledTimes(1);
  });
});
