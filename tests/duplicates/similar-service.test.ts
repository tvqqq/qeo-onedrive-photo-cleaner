import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { findSimilarCandidates, persistSimilarGroups, splitDHashBands } from "@/lib/duplicates/similar";

const open: AppDatabase[] = [];

afterEach(() => {
  while (open.length) open.pop()?.close();
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "qeo-similar-"));
  const db = createDatabase(join(dir, "test.db"));
  open.push(db);
  migrateDatabase(db);
  return db;
}

function insertPhoto(db: AppDatabase, id: string, hash: bigint, takenAt: number | null) {
  const now = Date.now();
  const bands = splitDHashBands(hash);
  db.prepare(`
    INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?, ?, 0, ?)
  `).run(`drive-${id}`, `${id}.jpg`, now);
  db.prepare(`
    INSERT INTO photos(id,drive_item_id,name,path,size_bytes,taken_at,etag,created_at,updated_at)
    VALUES (?, ?, ?, ?, 100, ?, ?, ?, ?)
  `).run(id, `drive-${id}`, `${id}.jpg`, `/Pictures/${id}.jpg`, takenAt, `etag-${id}`, now, now);
  db.prepare(`
    INSERT INTO photo_features(photo_id,dhash,lsh_band_0,lsh_band_1,lsh_band_2,lsh_band_3,feature_etag,updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, hash.toString(16).padStart(16, "0"), ...bands, `etag-${id}`, now);
}

describe("similar candidate selection", () => {
  it("allows one shared band when both photos are within 24 hours", () => {
    const db = setup();
    const base = 1_700_000_000_000;
    insertPhoto(db, "a", 0x1111000000000000n, base);
    insertPhoto(db, "b", 0x1111000100010001n, base + 60 * 60 * 1000);

    expect(findSimilarCandidates(db, 8).map((pair) => [pair.leftPhotoId, pair.rightPhotoId]))
      .toEqual([["a", "b"]]);
  });

  it("requires at least two shared bands when timestamps are unavailable", () => {
    const db = setup();
    insertPhoto(db, "a", 0x1111000000000000n, null);
    insertPhoto(db, "one-band", 0x1111000100010001n, null);
    insertPhoto(db, "two-band", 0x1111000000010001n, null);

    const pairs = findSimilarCandidates(db, 8).map((pair) => [pair.leftPhotoId, pair.rightPhotoId]);
    expect(pairs).toContainEqual(["a", "two-band"]);
    expect(pairs).not.toContainEqual(["a", "one-band"]);
  });

  it("persists similar groups with every deletion selection unchecked", () => {
    const db = setup();
    insertPhoto(db, "a", 0x1111000000000000n, null);
    insertPhoto(db, "b", 0x1111000000010001n, null);

    persistSimilarGroups(db, [{
      leftPhotoId: "a",
      rightPhotoId: "b",
      hammingDistance: 2,
      sharedBands: 2,
    }]);

    const group = db.prepare("SELECT type, status FROM duplicate_groups").get() as { type: string; status: string };
    const items = db.prepare("SELECT selected_for_delete FROM duplicate_group_items ORDER BY photo_id").all() as Array<{ selected_for_delete: number }>;
    expect(group).toEqual({ type: "similar", status: "pending" });
    expect(items.map((item) => item.selected_for_delete)).toEqual([0, 0]);
  });
});
