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

it("returns unreviewed photos with category source and confidence", () => {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-review-")), "test.db"));
  open.push(db);
  migrateDatabase(db);
  ensureTaxonomy(db);
  const now = Date.now();
  db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES ('d1','a.jpg',0,?)").run(now);
  db.prepare(`INSERT INTO photos(id,drive_item_id,name,path,size_bytes,etag,created_at,updated_at)
    VALUES ('p1','d1','a.jpg','/Pictures/a.jpg',100,'e1',?,?)`).run(now, now);
  writeAutomaticCategories(db, "p1", [{ slug: "travel", confidence: 0.78, source: "local-ai" }]);

  expect(listCategoryReviewQueue(db, 50)).toEqual([{
    photoId: "p1",
    name: "a.jpg",
    path: "/Pictures/a.jpg",
    reviewed: false,
    labels: [{ slug: "travel", name: "Travel", source: "local-ai", confidence: 0.78 }],
  }]);
});
