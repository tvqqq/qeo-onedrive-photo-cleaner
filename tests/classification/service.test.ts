import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  applyManualReview,
  ensureTaxonomy,
  selectModelSuggestions,
  writeAutomaticCategories,
} from "@/lib/classification/service";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

function setup() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-classify-")), "test.db"));
  open.push(db);
  migrateDatabase(db);
  ensureTaxonomy(db);
  const now = Date.now();
  db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES ('d1','a.jpg',0,?)").run(now);
  db.prepare(`INSERT INTO photos(id,drive_item_id,name,path,size_bytes,etag,created_at,updated_at)
    VALUES ('p1','d1','a.jpg','/Pictures/a.jpg',100,'e1',?,?)`).run(now, now);
  return db;
}

describe("classification service", () => {
  it("keeps at most three model labels above 0.20 and falls back to other", () => {
    expect(selectModelSuggestions([
      { label: "travel", score: 0.8 }, { label: "nature", score: 0.6 },
      { label: "friends", score: 0.3 }, { label: "food", score: 0.25 },
    ]).map((item) => item.slug)).toEqual(["travel", "nature", "friends"]);
    expect(selectModelSuggestions([{ label: "travel", score: 0.19 }])).toEqual([
      { slug: "other", confidence: 1, source: "local-ai" },
    ]);
  });

  it("manual add/remove decisions survive later automatic classification", () => {
    const db = setup();
    applyManualReview(db, "p1", { add: ["family"], remove: ["travel"], markReviewed: true });
    writeAutomaticCategories(db, "p1", [
      { slug: "travel", confidence: 0.9, source: "local-ai" },
      { slug: "food", confidence: 0.8, source: "local-ai" },
    ]);

    const rows = db.prepare(`SELECT c.slug, pc.source, pc.manual_state
      FROM photo_categories pc JOIN categories c ON c.id = pc.category_id
      WHERE pc.photo_id='p1' ORDER BY c.slug`).all() as Array<{ slug: string; source: string; manual_state: string | null }>;
    expect(rows).toEqual([
      { slug: "family", source: "manual", manual_state: "added" },
      { slug: "food", source: "local-ai", manual_state: null },
      { slug: "travel", source: "manual", manual_state: "removed" },
    ]);
    const photo = db.prepare("SELECT classification_reviewed FROM photos WHERE id='p1'").get() as { classification_reviewed: number };
    expect(photo.classification_reviewed).toBe(1);
  });
});
