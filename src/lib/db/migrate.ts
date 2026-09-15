import { fileURLToPath } from "node:url";
import type { AppDatabase } from "@/lib/db/client";
import { openAppDatabase } from "@/lib/db/client";
import { INITIAL_SCHEMA, MIGRATION_V2, SCHEMA_VERSION } from "@/lib/db/schema";

export function migrateDatabase(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const row = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as
    | { version: number | null }
    | undefined;
  const currentVersion = row?.version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (currentVersion === 0) {
      db.exec(INITIAL_SCHEMA);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
        SCHEMA_VERSION,
        Date.now(),
      );
    } else {
      for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version += 1) {
        if (version !== 2) {
          throw new Error(`Missing database migration for version ${version}`);
        }
        db.exec(MIGRATION_V2);
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
          version,
          Date.now(),
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const db = openAppDatabase();
  try {
    migrateDatabase(db);
  } finally {
    db.close();
  }
}
