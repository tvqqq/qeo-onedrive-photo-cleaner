import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { ensureTaxonomy, listCategoryReviewQueue, writeAutomaticCategories } from "@/lib/classification/service";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

it("returns unreviewed photos with full metadata plus category source and confidence", () => {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-review-")), "test.db"));
  open.push(db);
  migrateDatabase(db);
  ensureTaxonomy(db);
  const now = Date.now();
  const takenAt = Date.UTC(2026, 8, 1, 8, 30);
  db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES ('d1','a.jpg',0,?)").run(now);
  db.prepare(`
    INSERT INTO photos(
      id, drive_item_id, name, path, size_bytes, mime_type, width, height,
      taken_at, camera_make, camera_model, exposure_numerator, exposure_denominator,
      f_number, focal_length, iso, orientation, etag, created_at, updated_at
    ) VALUES ('p1','d1','a.jpg','/Pictures/a.jpg',2000000,'image/jpeg',4032,3024,?,?,?,?,?,?,?,?,?,'e1',?,?)
  `).run(takenAt, "Apple", "iPhone 15 Pro", 1, 120, 1.78, 6.86, 80, 1, now, now);
  writeAutomaticCategories(db, "p1", [{ slug: "travel", confidence: 0.78, source: "local-ai" }]);

  expect(listCategoryReviewQueue(db, 50)).toEqual([{
    photo: {
      photoId: "p1",
      driveItemId: "d1",
      name: "a.jpg",
      path: "/Pictures/a.jpg",
      sizeBytes: 2_000_000,
      mimeType: "image/jpeg",
      width: 4032,
      height: 3024,
      takenAt,
      remoteCreatedAt: null,
      remoteModifiedAt: null,
      cameraMake: "Apple",
      cameraModel: "iPhone 15 Pro",
      exposureNumerator: 1,
      exposureDenominator: 120,
      fNumber: 1.78,
      focalLength: 6.86,
      iso: 80,
      orientation: 1,
      createdByUserName: null,
      createdByDeviceName: null,
      createdByDeviceId: null,
      createdByApplicationName: null,
      createdByApplicationId: null,
      modifiedByUserName: null,
      modifiedByDeviceName: null,
      modifiedByDeviceId: null,
      modifiedByApplicationName: null,
      modifiedByApplicationId: null,
      etag: "e1",
      quickxorHash: null,
      sha256: null,
      tags: [],
    },
    reviewed: false,
    labels: [{ slug: "travel", name: "Travel", source: "local-ai", confidence: 0.78 }],
  }]);
});
