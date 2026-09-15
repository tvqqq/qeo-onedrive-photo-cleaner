import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  applyManualTag,
  ensureAiVocabulary,
  listActiveTagsForPhoto,
  listActiveTagsForPhotos,
  listPhotosNeedingTags,
  listTagCounts,
  replaceAiTagsForPhoto,
} from "@/lib/tags/repository";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

function database() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-tags-")), "test.db"));
  open.push(db);
  migrateDatabase(db);
  return db;
}

function insertPhoto(db: AppDatabase, id: string, etag: string, deleted = false) {
  const now = Date.now();
  db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?, ?, 0, ?)")
    .run(`drive-${id}`, `${id}.jpg`, now);
  db.prepare(`
    INSERT INTO photos(id,drive_item_id,name,path,size_bytes,mime_type,etag,deleted_remote_at,created_at,updated_at)
    VALUES (?, ?, ?, ?, 1, 'image/jpeg', ?, ?, ?, ?)
  `).run(id, `drive-${id}`, `${id}.jpg`, `/${id}.jpg`, etag, deleted ? now : null, now, now);
}

describe("tag repository", () => {
  it("seeds the curated vocabulary idempotently", () => {
    const db = database();
    ensureAiVocabulary(db);
    ensureAiVocabulary(db);
    expect((db.prepare("SELECT COUNT(*) AS count FROM tags").get() as { count: number }).count).toBe(80);
  });

  it("replaces AI tags while preserving manual overrides", () => {
    const db = database();
    insertPhoto(db, "p1", "e1");
    ensureAiVocabulary(db);

    replaceAiTagsForPhoto(db, "p1", [
      { slug: "travel", confidence: 0.9 },
      { slug: "beach", confidence: 0.8 },
    ], { taggedEtag: "e1", modelId: "clip-v1", taxonomyVersion: "qeo-tags-v1", taggedAt: 100 });
    applyManualTag(db, "p1", "Travel", "removed");
    applyManualTag(db, "p1", "Gia Đình", "active");

    replaceAiTagsForPhoto(db, "p1", [
      { slug: "travel", confidence: 0.99 },
      { slug: "city", confidence: 0.7 },
    ], { taggedEtag: "e1", modelId: "clip-v1", taxonomyVersion: "qeo-tags-v1", taggedAt: 200 });

    expect(listActiveTagsForPhoto(db, "p1")).toEqual([
      { slug: "city", name: "City", source: "ai", state: "active", confidence: 0.7 },
      { slug: "gia-dinh", name: "Gia Đình", source: "manual", state: "active", confidence: null },
    ]);
    const travel = db.prepare(`
      SELECT pt.source, pt.state, pt.confidence
      FROM photo_tags pt JOIN tags t ON t.id=pt.tag_id
      WHERE pt.photo_id='p1' AND t.slug='travel'
    `).get();
    expect(travel).toEqual({ source: "manual", state: "removed", confidence: null });
    expect(db.prepare("SELECT tagged_at FROM photo_tag_state WHERE photo_id='p1'").get()).toEqual({ tagged_at: 200 });
  });

  it("batch-loads active tags and counts only active tags on live photos", () => {
    const db = database();
    insertPhoto(db, "a", "ea");
    insertPhoto(db, "b", "eb");
    insertPhoto(db, "deleted", "ed", true);
    ensureAiVocabulary(db);
    applyManualTag(db, "a", "Family", "active");
    applyManualTag(db, "b", "Family", "active");
    applyManualTag(db, "b", "Travel", "removed");
    applyManualTag(db, "deleted", "Family", "active");

    const byPhoto = listActiveTagsForPhotos(db, ["a", "b"]);
    expect(byPhoto.get("a")?.map((tag) => tag.slug)).toEqual(["family"]);
    expect(byPhoto.get("b")?.map((tag) => tag.slug)).toEqual(["family"]);
    expect(listTagCounts(db, 10)).toEqual([{ slug: "family", name: "Family", count: 2 }]);
  });

  it("selects photos for first tagging or when etag/model/taxonomy changes", () => {
    const db = database();
    for (const [id, etag] of [["fresh", "e1"], ["same", "e2"], ["etag", "e3"], ["model", "e4"], ["taxonomy", "e5"]] as const) {
      insertPhoto(db, id, etag);
    }
    insertPhoto(db, "gone", "e6", true);
    const insertState = db.prepare(`
      INSERT INTO photo_tag_state(photo_id,tagged_etag,model_id,taxonomy_version,tagged_at)
      VALUES (?, ?, ?, ?, 1)
    `);
    insertState.run("same", "e2", "clip-v1", "qeo-tags-v1");
    insertState.run("etag", "old", "clip-v1", "qeo-tags-v1");
    insertState.run("model", "e4", "clip-old", "qeo-tags-v1");
    insertState.run("taxonomy", "e5", "clip-v1", "old-taxonomy");

    expect(listPhotosNeedingTags(db, "clip-v1", "qeo-tags-v1").map((photo) => photo.id)).toEqual([
      "etag", "fresh", "model", "taxonomy",
    ]);
  });
});
