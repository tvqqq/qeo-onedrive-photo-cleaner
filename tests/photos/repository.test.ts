import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { listPhotos } from "@/lib/photos/repository";
import { applyManualTag, ensureAiVocabulary } from "@/lib/tags/repository";

function database() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-photos-")), "test.db"));
  migrateDatabase(db);
  const now = Date.now();
  const insertNode = db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?, ?, 0, ?)");
  const insertPhoto = db.prepare(`
    INSERT INTO photos(
      id, drive_item_id, name, path, size_bytes, mime_type, width, height,
      taken_at, remote_modified_at, camera_make, camera_model, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const photos = [
    ["phone", "phone.jpg", "/Camera/phone.jpg", 400, "image/jpeg", 4032, 3024, Date.parse("2026-01-10T10:00:00Z"), Date.parse("2026-01-12T10:00:00Z"), "Apple", "iPhone 15 Pro"],
    ["trip", "trip.jpg", "/Trips/trip.jpg", 300, "image/jpeg", 6000, 4000, Date.parse("2026-01-20T10:00:00Z"), Date.parse("2026-01-21T10:00:00Z"), "Canon", "EOS R6"],
    ["graphic", "graphic.png", "/Design/graphic.png", 200, "image/png", 1200, 1200, Date.parse("2026-02-01T10:00:00Z"), Date.parse("2026-02-02T10:00:00Z"), null, null],
    ["old", "old.jpg", "/Archive/old.jpg", 100, "image/jpeg", 1024, 768, Date.parse("2025-12-01T10:00:00Z"), Date.parse("2025-12-02T10:00:00Z"), null, null],
  ] as const;
  for (const [id, name, path, size, mime, width, height, taken, modified, make, model] of photos) {
    insertNode.run(`drive-${id}`, name, now);
    insertPhoto.run(id, `drive-${id}`, name, path, size, mime, width, height, taken, modified, make, model, now, now);
  }
  db.prepare(`
    UPDATE photos SET
      created_by_device_name = 'iPhone',
      created_by_application_name = 'OneDrive',
      modified_by_device_name = 'Mac mini'
    WHERE id = 'phone'
  `).run();
  db.prepare("INSERT INTO categories(id,slug,name) VALUES ('travel','travel','Travel')").run();
  db.prepare("INSERT INTO photo_categories(photo_id,category_id,source,manual_state) VALUES ('trip','travel','manual','added')").run();
  db.prepare("INSERT INTO photo_categories(photo_id,category_id,source,manual_state) VALUES ('phone','travel','manual','removed')").run();
  return db;
}

describe("listPhotos", () => {
  it("paginates and searches filename, path, and camera metadata", () => {
    const db = database();
    const first = listPhotos(db, { page: 1, pageSize: 2, sort: "taken-desc" });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(4);
    expect(first.totalPages).toBe(2);

    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "taken-desc", search: "iphone" }).items.map((p) => p.name))
      .toEqual(["phone.jpg"]);
    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "taken-desc", search: "Trips" }).items.map((p) => p.name))
      .toEqual(["trip.jpg"]);
    db.close();
  });

  it("maps source identity metadata onto PhotoMetadata", () => {
    const db = database();

    const phone = listPhotos(db, { page: 1, pageSize: 60, sort: "name-asc" }).items
      .find((photo) => photo.photoId === "phone");

    expect(phone?.createdByDeviceName).toBe("iPhone");
    expect(phone?.createdByApplicationName).toBe("OneDrive");
    expect(phone?.modifiedByDeviceName).toBe("Mac mini");
    expect(phone?.createdByUserName).toBeNull();
    expect(phone?.modifiedByApplicationId).toBeNull();
    db.close();
  });

  it("filters MIME, category, and captured date without including manual removals", () => {
    const db = database();
    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "taken-desc", mimeType: "image/png" }).items.map((p) => p.name))
      .toEqual(["graphic.png"]);
    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "taken-desc", category: "travel" }).items.map((p) => p.name))
      .toEqual(["trip.jpg"]);
    expect(listPhotos(db, {
      page: 1,
      pageSize: 60,
      sort: "taken-desc",
      takenFrom: Date.parse("2026-01-01T00:00:00Z"),
      takenTo: Date.parse("2026-01-31T23:59:59.999Z"),
    }).items.map((p) => p.name)).toEqual(["trip.jpg", "phone.jpg"]);
    db.close();
  });

  it("requires every requested hashtag and ignores removed tag state", () => {
    const db = database();
    ensureAiVocabulary(db);
    applyManualTag(db, "phone", "Document", "active");
    applyManualTag(db, "phone", "Screenshot", "active");
    applyManualTag(db, "trip", "Document", "active");
    applyManualTag(db, "trip", "Screenshot", "removed");

    expect(listPhotos(db, {
      page: 1,
      pageSize: 60,
      sort: "taken-desc",
      tagSlugs: ["document", "screenshot"],
    }).items.map((p) => p.name)).toEqual(["phone.jpg"]);
    db.close();
  });

  it("uses only supported deterministic sort orders", () => {
    const db = database();
    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "size-desc" }).items.map((p) => p.name))
      .toEqual(["phone.jpg", "trip.jpg", "graphic.png", "old.jpg"]);
    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "name-asc" }).items.map((p) => p.name))
      .toEqual(["graphic.png", "old.jpg", "phone.jpg", "trip.jpg"]);
    expect(listPhotos(db, { page: 1, pageSize: 60, sort: "modified-asc" }).items.map((p) => p.name))
      .toEqual(["old.jpg", "phone.jpg", "trip.jpg", "graphic.png"]);
    db.close();
  });
});
