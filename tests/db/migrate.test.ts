import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";

describe("database migrations", () => {
  it("upgrades v1 in place without losing cleanup state", () => {
    const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-v1-")), "test.db"));
    db.exec(`
      CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
      INSERT INTO schema_migrations VALUES (1, 1);
      CREATE TABLE drive_nodes(drive_item_id TEXT PRIMARY KEY, parent_drive_item_id TEXT, name TEXT NOT NULL, is_folder INTEGER NOT NULL DEFAULT 0, etag TEXT, remote_created_at INTEGER, remote_modified_at INTEGER, deleted_remote_at INTEGER, updated_at INTEGER NOT NULL);
      CREATE TABLE photos(id TEXT PRIMARY KEY, drive_item_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, path TEXT NOT NULL DEFAULT '', size_bytes INTEGER NOT NULL DEFAULT 0, mime_type TEXT, quickxor_hash TEXT, sha256 TEXT, sha256_etag TEXT, width INTEGER, height INTEGER, taken_at INTEGER, remote_created_at INTEGER, remote_modified_at INTEGER, etag TEXT, deleted_remote_at INTEGER, classification_reviewed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE duplicate_groups(id TEXT PRIMARY KEY, type TEXT NOT NULL, confidence REAL, status TEXT NOT NULL DEFAULT 'pending', verified_sha256 TEXT, reviewed_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE duplicate_group_items(group_id TEXT NOT NULL, photo_id TEXT NOT NULL, recommended_keep INTEGER NOT NULL DEFAULT 0, selected_for_delete INTEGER NOT NULL DEFAULT 0, reviewed_etag TEXT, PRIMARY KEY(group_id, photo_id));
      CREATE TABLE categories(id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
      CREATE TABLE photo_categories(photo_id TEXT NOT NULL, category_id TEXT NOT NULL, confidence REAL, source TEXT NOT NULL, manual_state TEXT, reviewed_at INTEGER, PRIMARY KEY(photo_id, category_id));
      CREATE TABLE settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
      INSERT INTO drive_nodes(drive_item_id,name,updated_at) VALUES ('drive-1','photo.jpg',1);
      INSERT INTO photos(id,drive_item_id,name,path,size_bytes,created_at,updated_at) VALUES ('photo-1','drive-1','photo.jpg','/photo.jpg',1234,1,1);
      INSERT INTO duplicate_groups(id,type,status,created_at) VALUES ('exact:abc','exact','pending',1);
      INSERT INTO duplicate_group_items(group_id,photo_id,recommended_keep) VALUES ('exact:abc','photo-1',1);
      INSERT INTO categories(id,slug,name) VALUES ('travel','travel','Travel');
      INSERT INTO photo_categories(photo_id,category_id,source) VALUES ('photo-1','travel','manual');
      INSERT INTO settings(key,value_json,updated_at) VALUES ('dhash_threshold','8',1);
    `);

    migrateDatabase(db);

    const columns = db.prepare("PRAGMA table_info(photos)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "camera_make",
      "camera_model",
      "exposure_numerator",
      "exposure_denominator",
      "f_number",
      "focal_length",
      "iso",
      "orientation",
    ]));
    expect(db.prepare("SELECT name,size_bytes FROM photos WHERE id='photo-1'").get()).toEqual({ name: "photo.jpg", size_bytes: 1234 });
    expect(db.prepare("SELECT status FROM duplicate_groups WHERE id='exact:abc'").get()).toEqual({ status: "pending" });
    expect(db.prepare("SELECT source FROM photo_categories WHERE photo_id='photo-1'").get()).toEqual({ source: "manual" });
    expect(db.prepare("SELECT value_json FROM settings WHERE key='dhash_threshold'").get()).toEqual({ value_json: "8" });
    expect(db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toEqual({ version: 2 });

    db.close();
  });
});
