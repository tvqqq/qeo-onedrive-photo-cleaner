import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { listPendingDuplicateReviewGroups } from "@/lib/duplicates/review";

function database() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-duplicate-review-")), "test.db"));
  migrateDatabase(db);
  return db;
}

function insertPhoto(db: ReturnType<typeof database>, id: string, name: string, cameraModel: string) {
  const now = Date.UTC(2026, 0, 2);
  db.prepare("INSERT INTO drive_nodes(drive_item_id,name,updated_at) VALUES (?,?,?)")
    .run(`drive-${id}`, name, now);
  db.prepare(`
    INSERT INTO photos(
      id, drive_item_id, name, path, size_bytes, mime_type, width, height,
      taken_at, remote_created_at, remote_modified_at, camera_make, camera_model,
      exposure_numerator, exposure_denominator, f_number, focal_length, iso,
      orientation, etag, quickxor_hash, sha256, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, `drive-${id}`, name, `/Camera/${name}`, 4_718_592, "image/jpeg", 4032, 3024,
    now, now, now, "Apple", cameraModel, 1, 120, 1.78, 24, 80, 1,
    `etag-${id}`, "qxor", "same-sha", now, now,
  );
}

describe("duplicate review repository", () => {
  it("returns pending exact and similar groups with full photo metadata", () => {
    const db = database();
    insertPhoto(db, "keeper", "keeper.jpg", "iPhone 15 Pro");
    insertPhoto(db, "copy", "copy.jpg", "iPhone 15 Pro");
    insertPhoto(db, "similar", "similar.jpg", "iPhone 14 Pro");

    db.prepare("INSERT INTO duplicate_groups(id,type,status,verified_sha256,created_at) VALUES (?,?,?,?,?)")
      .run("exact-1", "exact", "pending", "same-sha", 2);
    db.prepare("INSERT INTO duplicate_groups(id,type,status,confidence,created_at) VALUES (?,?,?,?,?)")
      .run("similar-1", "similar", "pending", 0.96, 1);
    db.prepare("INSERT INTO duplicate_group_items(group_id,photo_id,recommended_keep,selected_for_delete) VALUES (?,?,?,?)")
      .run("exact-1", "keeper", 1, 0);
    db.prepare("INSERT INTO duplicate_group_items(group_id,photo_id,recommended_keep,selected_for_delete) VALUES (?,?,?,?)")
      .run("exact-1", "copy", 0, 1);
    db.prepare("INSERT INTO duplicate_group_items(group_id,photo_id,recommended_keep,selected_for_delete) VALUES (?,?,?,?)")
      .run("similar-1", "similar", 0, 0);

    const groups = listPendingDuplicateReviewGroups(db);
    const exact = groups.find((group) => group.type === "exact");
    const similar = groups.find((group) => group.type === "similar");

    expect(exact).toMatchObject({ id: "exact-1", type: "exact", verifiedSha256: "same-sha" });
    expect(exact?.items).toHaveLength(2);
    expect(exact?.items.find((item) => item.recommendedKeep)?.photo.cameraModel).toBe("iPhone 15 Pro");
    expect(exact?.items.find((item) => item.selectedForDelete)?.photo.width).toBe(4032);

    expect(similar).toMatchObject({ id: "similar-1", type: "similar", confidence: 0.96 });
    expect(similar?.items[0]?.photo).toMatchObject({ name: "similar.jpg", cameraModel: "iPhone 14 Pro", height: 3024 });

    db.close();
  });
});
