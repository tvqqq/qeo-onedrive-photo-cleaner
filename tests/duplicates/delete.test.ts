import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { deleteApprovedExactGroup } from "@/lib/duplicates/delete";

function setup() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-delete-")), "test.db"));
  migrateDatabase(db);
  const now = Date.now();
  for (const id of ["keeper", "copy"]) {
    db.prepare(`INSERT INTO drive_nodes(drive_item_id,name,updated_at) VALUES (?,?,?)`).run(id, `${id}.jpg`, now);
    db.prepare(`
      INSERT INTO photos(id,drive_item_id,name,path,size_bytes,mime_type,quickxor_hash,etag,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(id, id, `${id}.jpg`, `/${id}.jpg`, 100, "image/jpeg", "same-qxor", `${id}-etag`, now, now);
  }
  db.prepare(`
    INSERT INTO duplicate_groups(id,type,status,verified_sha256,created_at)
    VALUES ('group-1','exact','pending','sha',?)
  `).run(now);
  db.prepare(`
    INSERT INTO duplicate_group_items(group_id,photo_id,recommended_keep,selected_for_delete,reviewed_etag)
    VALUES ('group-1','keeper',1,0,'keeper-etag'),('group-1','copy',0,1,'copy-etag')
  `).run();
  return db;
}

describe("approved exact duplicate deletion", () => {
  it("blocks deletion when the item changed after review", async () => {
    const db = setup();
    const drive = {
      getItem: vi.fn().mockResolvedValue({ id: "copy", eTag: "new-etag" }),
      deleteItem: vi.fn(),
    };

    await expect(deleteApprovedExactGroup({ db, drive }, "group-1", ["copy"]))
      .rejects.toThrow("Item changed after review");
    expect(drive.deleteItem).not.toHaveBeenCalled();
  });

  it("never allows the recommended keeper to be deleted", async () => {
    const db = setup();
    const drive = { getItem: vi.fn(), deleteItem: vi.fn() };
    await expect(deleteApprovedExactGroup({ db, drive }, "group-1", ["keeper"]))
      .rejects.toThrow(/keeper/i);
    expect(drive.deleteItem).not.toHaveBeenCalled();
  });

  it("uses normal delete with the reviewed etag for approved copies", async () => {
    const db = setup();
    const drive = {
      getItem: vi.fn().mockResolvedValue({ id: "copy", eTag: "copy-etag" }),
      deleteItem: vi.fn().mockResolvedValue(undefined),
    };

    const result = await deleteApprovedExactGroup({ db, drive }, "group-1", ["copy"]);

    expect(result.deleted).toBe(1);
    expect(drive.deleteItem).toHaveBeenCalledWith("copy", "copy-etag");
    const row = db.prepare("SELECT deleted_remote_at FROM photos WHERE id = 'copy'").get() as { deleted_remote_at: number | null };
    expect(row.deleted_remote_at).not.toBeNull();
  });
});
