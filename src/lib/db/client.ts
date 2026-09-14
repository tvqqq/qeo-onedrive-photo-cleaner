import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "@/lib/env";

export type AppDatabase = DatabaseSync;

export function createDatabase(path: string): AppDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  return db;
}

export function openAppDatabase(): AppDatabase {
  return createDatabase(join(env.DATA_DIR, "qeo-photo-cleaner.db"));
}
